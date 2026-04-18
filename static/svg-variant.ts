import { XmlParser, XmlAttribute, XmlElement, XmlText, XmlComment } from "xml-trueformat";
import type { XmlChildNode } from "xml-trueformat";
import { type Undefinable, isNotUndefined } from "option-t/undefinable";
import { andThenForUndefinable } from "option-t/undefinable/and_then";
import { unwrapOrElseForUndefinable } from "option-t/undefinable/unwrap_or_else";
import { type SvgFileName, svgFile } from "./svg-meta.ts";

const DIR = import.meta.dirname;
const filePath = (name: SvgFileName): string => `${DIR}/${name}`;

const read  = (name: SvgFileName): Promise<string> => Bun.file(filePath(name)).text();
const write = async (name: SvgFileName, content: string): Promise<void> => { await Bun.write(filePath(name), content); };

async function svgo(input: SvgFileName, output: SvgFileName): Promise<void> {
  const proc = Bun.spawn(
    ["svgo", "--multipass", "-i", filePath(input), "-o", filePath(output)],
    { stderr: "inherit" },
  );
  if (await proc.exited !== 0) throw new Error(`svgo failed for ${input}`);
}

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
  if (!isNotUndefined(g) || !isNotUndefined(rect)) throw new Error("No <g>/<rect> in avatar.svg");

  const rw = Number(unwrapOrElseForUndefinable(rect.getAttributeValue("width"), () => { throw new Error("No width attribute on <rect> in avatar.svg"); }));
  const rh = Number(unwrapOrElseForUndefinable(rect.getAttributeValue("height"), () => { throw new Error("No height attribute on <rect> in avatar.svg"); }));
  // Floor to 1dp: small safety margin so artwork fits inside the incircle
  const k = Math.floor(w / Math.hypot(rw, rh) * 10) / 10;
  return { cx: w / 2, cy: h / 2, k };
}

async function makeRound(scale: number, outFile: SvgFileName, cx: number, cy: number): Promise<void> {
  const doc = XmlParser.parse(await read(svgFile("avatar.svg")));
  const svg = doc.getRootElement();

  // Add transform to <g>
  const g: Undefinable<XmlElement> = svg.getFirstElementByName("g");
  if (!isNotUndefined(g)) throw new Error("No <g> in avatar.svg");

  // Inject maskable icon / safe zone comment before the <g>
  const safeZoneRadius = Math.round(cx * scale * 0.8 * 100) / 100;
  const comment = new XmlComment(
    ` PWA maskable / Android adaptive icon: artwork at ${(scale * 100).toFixed(0)}% of canvas,` +
    ` safe-zone radius ${safeZoneRadius.toString()} (80% of half-width).` +
    ` Background fills full canvas for any launcher crop shape. `);

  // Insert comment as a sibling before <g> in svg.children
  const gIndex = svg.children.indexOf(g);
  if (gIndex !== -1) {
    svg.children.splice(gIndex, 0, comment, new XmlText("\n    "));
  }

  g.attributes.push(new XmlAttribute("transform",
    `translate(${cx.toString()} ${cy.toString()}) scale(${scale.toString()}, ${scale.toString()}) translate(-${cx.toString()} -${cy.toString()})`));

  await write(outFile, doc.toString());
}

async function makeBimi(): Promise<void> {
  const doc = XmlParser.parse(await read(svgFile("avatar-round.svg")));
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
  svg.children = svg.children.filter(
    (n): n is XmlChildNode => !(n instanceof XmlElement && n.tagName === "metadata"));

  await write(svgFile("avatar-bimi.svg"), doc.toString());
}

async function main(): Promise<void> {
  const src = await read(svgFile("avatar.svg"));
  const { k, cx, cy } = computeGeometry(XmlParser.parse(src).getRootElement());
  await Promise.all([
    makeRound(k,         svgFile("avatar-round.svg"),         cx, cy),
    makeRound(k * 0.875, svgFile("avatar-round-smaller.svg"), cx, cy),
  ]);
  await makeBimi();
  await Promise.all([
    svgo(svgFile("avatar.svg"),       svgFile("avatar.min.svg")),
    svgo(svgFile("avatar-round.svg"), svgFile("avatar-round.min.svg")),
    svgo(svgFile("avatar-bimi.svg"),  svgFile("avatar-bimi.min.svg")),
  ]);
}

await main();
