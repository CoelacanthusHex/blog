// SPDX-License-Identifier: MPL-2.0
// svg-merge.ts — merges *.image.svg + avatar.metadata.svg into full *.svg files,
// then minifies them with svgo.
// Run with: pnpm tsx svg-merge.ts
// Inputs:  avatar.image.svg (static/),
//          avatar-maskable.image.svg, avatar-maskable-shadow.image.svg (.ninja_build/),
//          avatar-bimi.svg (static/), avatar.metadata.svg (static/)
// Outputs: avatar.svg, avatar-maskable.svg, avatar-maskable-shadow.svg,
//          avatar.min.svg, avatar-maskable.min.svg, avatar-maskable-shadow.min.svg,
//          avatar-bimi.min.svg (all static/)

import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { XmlParser, XmlElement, XmlText } from "xml-trueformat";
import { type Undefinable, isNotUndefined } from "option-t/undefinable";
import { type SvgFileName, svgFile } from "./avatar-meta-types.ts";
import { writeStableAsync } from "./write-stable.ts";
import { ARTWORK_ID, extractAvatarMeta, findElementById, textContent } from "./svg-meta.ts";
import { contentInstanceID, documentIdentifier, renditionDocumentID, type ResourceReference } from "./avatar-identity.ts";
import type { XmpDocumentId } from "./avatar-meta-types.ts";

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

  // Minification is another serialization of the same rendition.
  const doc = XmlParser.parse(await read(output));
  const description = doc.getRootElement().getFirstElementByName("metadata")
    ?.getFirstElementByName("rdf:RDF")?.getFirstElementByName("rdf:Description");
  if (description !== undefined) {
    const documentID = textContent(description.getFirstElementByName("xmpMM:DocumentID")) as XmpDocumentId;
    setText(description, "xmpMM:InstanceID", "");
    setText(description, "xmpMM:InstanceID", contentInstanceID(documentID, [doc.toString()]));
    await writeStableAsync(filePath(output), doc.toString());
  }
}

function setText(parent: XmlElement, name: string, value: string): void {
  let element = parent.getFirstElementByName(name);
  if (element === undefined) {
    element = new XmlElement(name);
    parent.addElement(element);
  }
  element.children = [new XmlText(value.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;"))];
  element.selfClosing = false;
}

/** Merge an image SVG (by raw content string) with avatar.metadata.svg to produce a full *.svg.
 *  Inserts <metadata> before the root child containing #artwork,
 *  reproducing the original avatar.svg structure. */
async function mergeSvg(imageContent: string, outSvg: SvgFileName, parent: ResourceReference | null): Promise<ResourceReference> {
  const [imageDoc, metaDoc] = await Promise.all([
    Promise.resolve(XmlParser.parse(imageContent)),
    read(svgFile("avatar.metadata.svg")).then(s => XmlParser.parse(s)),
  ]);

  const svg = imageDoc.getRootElement();
  const metaSvg = metaDoc.getRootElement();

  const metadataEl: Undefinable<XmlElement> = metaSvg.getFirstElementByName("metadata");
  if (!isNotUndefined(metadataEl)) throw new Error("No <metadata> in avatar.metadata.svg");

  const sourceMeta = extractAvatarMeta(filePath(svgFile("avatar.metadata.svg")), "en");
  const originalDocumentID = sourceMeta.identity.originalDocumentID ?? sourceMeta.identity.documentID;
  if (originalDocumentID === null || sourceMeta.identity.documentID === null) {
    throw new Error("Missing original document identity in avatar.metadata.svg");
  }
  const documentID = parent === null ? sourceMeta.identity.documentID : renditionDocumentID(originalDocumentID, {
    variant: outSvg.slice(0, -".svg".length), dimensions: "scalable", mime: "image/svg+xml",
  });
  const rdf = metadataEl.getFirstElementByName("rdf:RDF");
  const description = rdf?.getFirstElementByName("rdf:Description");
  if (rdf === undefined || description === undefined) {
    throw new Error("Missing RDF description in avatar.metadata.svg");
  }
  const identifier = documentIdentifier(documentID);
  setText(description, "xmpMM:DocumentID", documentID);
  setText(description, "xmpMM:OriginalDocumentID", originalDocumentID);
  setText(description, "xmpMM:InstanceID", "");
  setText(description, "dc:identifier", identifier);
  const identifiers = description.getFirstElementByName("xmp:Identifier")?.getFirstElementByName("rdf:Bag");
  if (identifiers === undefined) {
    throw new Error("Missing xmp:Identifier bag in avatar.metadata.svg");
  }
  identifiers.children = [new XmlElement("rdf:li", [], [new XmlText(identifier)])];
  description.children = description.children.filter(node => !(node instanceof XmlElement && node.tagName === "xmpMM:DerivedFrom"));
  if (parent !== null) {
    rdf.setAttributeValue("xmlns:stRef", "http://ns.adobe.com/xap/1.0/sType/ResourceRef#");
    const derivedFrom = new XmlElement("xmpMM:DerivedFrom");
    derivedFrom.setAttributeValue("rdf:parseType", "Resource");
    const sourcePath = new XmlElement("stRef:filePath");
    sourcePath.setAttributeValue("rdf:resource", parent.filePath);
    derivedFrom.addElement(sourcePath);
    setText(derivedFrom, "stRef:documentID", parent.documentID);
    setText(derivedFrom, "stRef:instanceID", parent.instanceID);
    description.addElement(derivedFrom);
  }

  const artworkRoot = svg.children.find(
    (node): node is XmlElement => node instanceof XmlElement && isNotUndefined(findElementById(node, ARTWORK_ID))
  );
  if (!isNotUndefined(artworkRoot)) {
    throw new Error(`No #artwork in source for ${outSvg}`);
  }

  svg.addElement(metadataEl, { before: artworkRoot });

  const instanceID = contentInstanceID(documentID, [imageDoc.toString()]);
  setText(description, "xmpMM:InstanceID", instanceID);
  await writeStableAsync(filePath(outSvg), imageDoc.toString());
  return { documentID, instanceID, filePath: outSvg };
}

async function main(): Promise<void> {
  const [avatarImg, roundImg, roundSmallerImg] = await Promise.all([
    read(svgFile("avatar.image.svg")),
    readBuild("avatar-maskable.image.svg"),
    readBuild("avatar-maskable-shadow.image.svg"),
  ]);

  const original = await mergeSvg(avatarImg, svgFile("avatar.svg"), null);
  await Promise.all([
    mergeSvg(roundImg,         svgFile("avatar-maskable.svg"), original),
    mergeSvg(roundSmallerImg,  svgFile("avatar-maskable-shadow.svg"), original),
  ]);

  await Promise.all([
    svgo(svgFile("avatar.svg"),       svgFile("avatar.min.svg")),
    svgo(svgFile("avatar-maskable.svg"), svgFile("avatar-maskable.min.svg")),
    svgo(svgFile("avatar-maskable-shadow.svg"), svgFile("avatar-maskable-shadow.min.svg")),
    svgo(svgFile("avatar-bimi.svg"),  svgFile("avatar-bimi.min.svg")),
  ]);
}

await main();
