// SPDX-License-Identifier: MPL-2.0
// svg-merge.ts — merges *.image.svg + avatar.metadata.svg into full *.svg files,
// then minifies them with svgo.
// Run with: bun run svg-merge.ts
// Inputs:  avatar.image.svg (static/),
//          avatar-maskable.image.svg, avatar-maskable-shadow.image.svg (.ninja_build/),
//          avatar-bimi.svg (static/), avatar.metadata.svg (static/)
// Outputs: avatar.svg, avatar-maskable.svg, avatar-maskable-shadow.svg,
//          avatar.min.svg, avatar-maskable.min.svg, avatar-bimi.min.svg (all static/)

import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { XmlParser, XmlElement, XmlText } from "xml-trueformat";
import { type Undefinable, isNotUndefined } from "option-t/undefinable";
import { type SvgFileName, svgFile } from "./avatar-meta-types.ts";
import { writeStableAsync } from "./write-stable.ts";

const DIR = import.meta.dirname;
const BUILD_DIR = `${DIR}/.ninja_build`;
const filePath = (name: SvgFileName): string => `${DIR}/${name}`;
const buildPath = (name: string): string => `${BUILD_DIR}/${name}`;

const read      = (name: SvgFileName): Promise<string> => readFile(filePath(name), "utf8");
const readBuild = (name: string): Promise<string>      => readFile(buildPath(name), "utf8");

async function svgo(input: SvgFileName, output: SvgFileName): Promise<void> {
  const proc = spawn(
    "svgo", ["--multipass", "-i", filePath(input), "-o", filePath(output)],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  const code = await new Promise<number>((res) => proc.on("close", res));
  if (code !== 0) throw new Error(`svgo failed for ${input}`);
}

/** Merge an image SVG (by raw content string) with avatar.metadata.svg to produce a full *.svg.
 *  Inserts the <metadata> element just before the first <g> in the image SVG,
 *  reproducing the original avatar.svg structure. */
async function mergeSvg(imageContent: string, outSvg: SvgFileName): Promise<void> {
  const [imageDoc, metaDoc] = await Promise.all([
    Promise.resolve(XmlParser.parse(imageContent)),
    read(svgFile("avatar.metadata.svg")).then(s => XmlParser.parse(s)),
  ]);

  const svg = imageDoc.getRootElement();
  const metaSvg = metaDoc.getRootElement();

  const metadataEl: Undefinable<XmlElement> = metaSvg.getFirstElementByName("metadata");
  if (!isNotUndefined(metadataEl)) throw new Error("No <metadata> in avatar.metadata.svg");

  const gIndex = svg.children.findIndex(
    (n): n is XmlElement => n instanceof XmlElement && n.tagName === "g"
  );
  if (gIndex === -1) throw new Error(`No <g> in source for ${outSvg}`);

  svg.children.splice(gIndex - 1, 0, new XmlText("\n    "), metadataEl);

  await writeStableAsync(filePath(outSvg), imageDoc.toString());
}

async function main(): Promise<void> {
  const [avatarImg, roundImg, roundSmallerImg] = await Promise.all([
    read(svgFile("avatar.image.svg")),
    readBuild("avatar-maskable.image.svg"),
    readBuild("avatar-maskable-shadow.image.svg"),
  ]);

  await Promise.all([
    mergeSvg(avatarImg,        svgFile("avatar.svg")),
    mergeSvg(roundImg,         svgFile("avatar-maskable.svg")),
    mergeSvg(roundSmallerImg,  svgFile("avatar-maskable-shadow.svg")),
  ]);

  await Promise.all([
    svgo(svgFile("avatar.svg"),       svgFile("avatar.min.svg")),
    svgo(svgFile("avatar-maskable.svg"), svgFile("avatar-maskable.min.svg")),
    svgo(svgFile("avatar-bimi.svg"),  svgFile("avatar-bimi.min.svg")),
  ]);
}

await main();
