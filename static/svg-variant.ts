import { XmlParser, XmlAttribute, XmlElement, XmlText } from "xml-trueformat";
import type { XmlChildNode } from "xml-trueformat";

const DIR = import.meta.dirname;
const filePath = (name: string): string => `${DIR}/${name}`;

const read  = (name: string): Promise<string> => Bun.file(filePath(name)).text();
const write = async (name: string, content: string): Promise<void> => { await Bun.write(filePath(name), content); };

async function svgo(input: string, output: string): Promise<void> {
  const proc = Bun.spawn(["svgo", "--multipass", "-i", filePath(input), "-o", filePath(output)]);
  if (await proc.exited !== 0) throw new Error(`svgo failed for ${input}`);
}

function computeGeometry(svg: XmlElement): { cx: number; cy: number; k: number } {
  const viewBox = svg.getAttributeValue("viewBox");
  if (viewBox === undefined) throw new Error("No viewBox on <svg>");
  const parts = viewBox.trim().split(/\s+/).map(Number);
  const w = parts[2];
  const h = parts[3];
  if (w === undefined || h === undefined) throw new Error("Invalid viewBox on <svg>");

  const g    = svg.getFirstElementByName("g");
  const rect = g?.getFirstElementByName("rect");
  if (g === undefined || rect === undefined) throw new Error("No <g>/<rect> in avatar.svg");

  const rw = Number(rect.getAttributeValue("width"));
  const rh = Number(rect.getAttributeValue("height"));
  // Floor to 2dp: small safety margin so artwork fits inside the incircle
  const k = Math.floor(w / Math.hypot(rw, rh) * 100) / 100;
  return { cx: w / 2, cy: h / 2, k };
}

async function makeRound(scale: number, outFile: string): Promise<void> {
  const doc = XmlParser.parse(await read("avatar.svg"));
  const svg = doc.getRootElement();
  const { cx, cy } = computeGeometry(svg);

  // Update <title> to reflect circle-fit variant
  const title = svg.getFirstElementByName("title");
  const firstChild: XmlChildNode | undefined = title?.children[0];
  if (firstChild instanceof XmlText) {
    firstChild.text += " (fit into circle)";
  }

  // Add transform to <g>
  const g = svg.getFirstElementByName("g");
  if (g === undefined) throw new Error("No <g> in avatar.svg");
  g.attributes.push(new XmlAttribute("transform",
    `translate(${cx.toString()} ${cy.toString()}) scale(${scale.toString()}, ${scale.toString()}) translate(-${cx.toString()} -${cy.toString()})`));

  await write(outFile, doc.toString());
}

async function makeBimi(): Promise<void> {
  const doc = XmlParser.parse(await read("avatar-round.svg"));
  const svg = doc.getRootElement();

  const versionAttr = svg.getAttribute("version");
  if (versionAttr === undefined) throw new Error("No version attribute on <svg>");
  versionAttr.value = "1.2";
  svg.attributes.splice(svg.attributes.indexOf(versionAttr) + 1, 0,
    new XmlAttribute("baseProfile", "tiny-ps", versionAttr.leadingWs));

  svg.children = svg.children.filter(
    (n): n is XmlChildNode => !(n instanceof XmlElement && (n.tagName === "desc" || n.tagName === "metadata")));

  await write("avatar-bimi.svg", doc.toString());
}

async function main(): Promise<void> {
  const { k } = computeGeometry(XmlParser.parse(await read("avatar.svg")).getRootElement());
  await Promise.all([
    makeRound(k,         "avatar-round.svg"),
    makeRound(k * 0.875, "avatar-round-smaller.svg"),
  ]);
  await makeBimi();
  await Promise.all([
    svgo("avatar.svg",       "avatar.min.svg"),
    svgo("avatar-round.svg", "avatar-round.min.svg"),
    svgo("avatar-bimi.svg",  "avatar-bimi.min.svg"),
  ]);
}

await main();
