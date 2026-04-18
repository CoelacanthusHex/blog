// SPDX-License-Identifier: MPL-2.0
// svg-variant.ts — generates image-only SVG variants from avatar.image.svg.
// Run with: bun run svg-variant.ts
// Inputs:  avatar.image.svg
// Outputs: avatar-maskable.image.svg, avatar-maskable-shadow.image.svg, avatar-bimi.svg

import { readFile, writeFile } from "node:fs/promises";
import { XmlParser, XmlAttribute, XmlElement, XmlText, XmlComment } from "xml-trueformat";
import type { XmlChildNode } from "xml-trueformat";
import { type Undefinable, isNotUndefined } from "option-t/undefinable";
import { andThenForUndefinable } from "option-t/undefinable/and_then";
import { unwrapOrElseForUndefinable } from "option-t/undefinable/unwrap_or_else";
import { type SvgFileName, svgFile } from "./avatar-meta-types.ts";
import { writeStableAsync } from "./write-stable.ts";

const DIR = import.meta.dirname;
const BUILD_DIR = `${DIR}/.ninja_build`;
const filePath = (name: SvgFileName): string => `${DIR}/${name}`;
const buildPath = (name: string): string => `${BUILD_DIR}/${name}`;

const read  = (name: SvgFileName): Promise<string> => readFile(filePath(name), "utf8");
const write = (name: SvgFileName, content: string): Promise<void> => writeFile(filePath(name), content, "utf8");

interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function parseViewBox(svg: XmlElement): ViewBox {
  const raw: Undefinable<string> = svg.getAttributeValue("viewBox");
  if (!isNotUndefined(raw)) throw new Error("No viewBox on <svg>");
  const parts = raw.trim().split(/\s+/).map(Number);
  const [x, y, w, h] = parts;
  if (x === undefined || y === undefined || w === undefined || h === undefined || parts.length !== 4) {
    throw new Error(`Invalid viewBox on <svg>: "${raw}"`);
  }
  return { x, y, w, h };
}

function computeGeometry(svg: XmlElement): { cx: number; cy: number; k: number } {
  const { w, h } = parseViewBox(svg);

  const g: Undefinable<XmlElement> = svg.getFirstElementByName("g");
  const rect: Undefinable<XmlElement> = andThenForUndefinable(g, (el) => el.getFirstElementByName("rect"));
  if (!isNotUndefined(g) || !isNotUndefined(rect)) throw new Error("No <g>/<rect> in avatar.image.svg");

  const rw = Number(unwrapOrElseForUndefinable(rect.getAttributeValue("width"), () => { throw new Error("No width attribute on <rect> in avatar.image.svg"); }));
  const rh = Number(unwrapOrElseForUndefinable(rect.getAttributeValue("height"), () => { throw new Error("No height attribute on <rect> in avatar.image.svg"); }));
  // Floor to 1dp: small safety margin so artwork fits inside the incircle
  const k = Math.floor(w / Math.hypot(rw, rh) * 10) / 10;
  return { cx: w / 2, cy: h / 2, k };
}

/** Generate an image-only round variant from avatar.image.svg.
 *  Written to .ninja_build/ as the direct rasterization input (not a served file).
 *  Uses writeStable so mtime is preserved when content is unchanged — critical for
 *  Ninja restat=1 to skip rsvg_convert on metadata-only changes. */
async function makeRoundImage(scale: number, outName: string, cx: number, cy: number): Promise<void> {
  const doc = XmlParser.parse(await read(svgFile("avatar.image.svg")));
  const svg = doc.getRootElement();

  const g: Undefinable<XmlElement> = svg.getFirstElementByName("g");
  if (!isNotUndefined(g)) throw new Error("No <g> in avatar.image.svg");

  // Inject PWA maskable / safe-zone comment before the <g>
  const safeZoneRadius = Math.round(cx * scale * 0.8 * 100) / 100;
  const comment = new XmlComment(
    ` PWA maskable / Android adaptive icon: artwork at ${(scale * 100).toFixed(0)}% of canvas,` +
    ` Can be used for any launcher crop shape. ` +
    ` See also https://www.w3.org/TR/appmanifest/#icon-masks`);

  const gIndex = svg.children.indexOf(g);
  if (gIndex !== -1) {
    svg.children.splice(gIndex, 0, comment, new XmlText("\n    "));
  }

  g.attributes.push(new XmlAttribute("transform",
    `translate(${cx.toString()} ${cy.toString()}) scale(${scale.toString()}, ${scale.toString()}) translate(-${cx.toString()} -${cy.toString()})`));

  await writeStableAsync(buildPath(outName), doc.toString());
}

async function makeBimi(): Promise<void> {
  // Read from .ninja_build/avatar-maskable.image.svg (image-only, no metadata)
  const doc = XmlParser.parse(await readFile(buildPath("avatar-maskable.image.svg"), "utf8"));
  const svg = doc.getRootElement();

  // Upgrade to SVG 1.2 tiny-ps
  const versionAttr: Undefinable<XmlAttribute> = svg.getAttribute("version");
  if (!isNotUndefined(versionAttr)) throw new Error("No version attribute on <svg>");
  versionAttr.value = "1.2";
  svg.attributes.splice(svg.attributes.indexOf(versionAttr) + 1, 0,
    new XmlAttribute("baseProfile", "tiny-ps", versionAttr.leadingWs));

  // Strip aria-labelledby: not in the SVG tiny-ps RNC schema (closed attribute model)
  const ariaAttr: Undefinable<XmlAttribute> = svg.getAttribute("aria-labelledby");
  if (isNotUndefined(ariaAttr)) {
    svg.attributes.splice(svg.attributes.indexOf(ariaAttr), 1);
  }

  // Strip color-interpolation: not in the SVG tiny-ps RNC schema
  const colorInterpAttr: Undefinable<XmlAttribute> = svg.getAttribute("color-interpolation");
  if (isNotUndefined(colorInterpAttr)) {
    svg.attributes.splice(svg.attributes.indexOf(colorInterpAttr), 1);
  }

  // Strip <metadata>: contains external namespace URIs (CC, DC, XMP) forbidden by tiny-ps.
  // Keep <desc>: explicitly permitted and recommended for accessibility by the tiny-ps spec.
  // Note: avatar-maskable.image.svg has no <metadata>, so this filter is a no-op but kept for safety.
  svg.children = svg.children.filter(
    (n): n is XmlChildNode => !(n instanceof XmlElement && n.tagName === "metadata"));

  await write(svgFile("avatar-bimi.svg"), doc.toString());
}

async function main(): Promise<void> {
  await writeFile(`${BUILD_DIR}/.keep`, "").catch(() => { /* ensure build dir exists */ });

  const src = await read(svgFile("avatar.image.svg"));
  const { k, cx, cy } = computeGeometry(XmlParser.parse(src).getRootElement());

  // Generate image-only variants into .ninja_build/ (no metadata) — rasterization inputs
  await Promise.all([
    makeRoundImage(k,         "avatar-maskable.image.svg",        cx, cy),
    makeRoundImage(k * 0.875, "avatar-maskable-shadow.image.svg", cx, cy),
  ]);

  // Generate BIMI from image-only round variant (reads from .ninja_build/)
  await makeBimi();
}

await main();
