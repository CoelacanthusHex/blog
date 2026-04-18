import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { isNotUndefined, type Undefinable } from "option-t/undefinable";
import { isNotNull } from "option-t/nullable";
import { type AvatarMeta, type LocalizedText, type XmpInstanceId, extractAvatarMeta } from "./svg-meta.ts";

type Meta = AvatarMeta;

/** A string that has been XML-escaped. Prevents raw strings from being interpolated into XML. */
type EscapedXml = string & { readonly __escapedXml: unique symbol };

/** A namespace-qualified XML tag name of the form "prefix:local". */
type XmpTag = `${string}:${string}`;

/** A non-empty readonly array — used to enforce seq/bag fields always have at least one item. */
type NonEmptyArray<T> = readonly [T, ...T[]];

function xmlEscape(s: string): EscapedXml {
  return s
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&apos;") as EscapedXml;
}

function extractMeta(svgPath: string, primaryLocale: string): Meta {
  return extractAvatarMeta(svgPath, primaryLocale);
}

type XmpField =
  | { kind: "text";         tag: XmpTag; value: string }
  | { kind: "langalt";      tag: XmpTag; value: LocalizedText }
  | { kind: "resource";     tag: XmpTag; href: string }
  | { kind: "seq";          tag: XmpTag; items: NonEmptyArray<string> }
  | { kind: "bag";          tag: XmpTag; items: NonEmptyArray<string> }
  | { kind: "bag-resource"; tag: XmpTag; hrefs: NonEmptyArray<string> };

function buildLangAlt(localized: LocalizedText): string {
  const entries: string[] = [];
  if (localized.defaultText.length > 0) {
    entries.push(`<rdf:li xml:lang="x-default">${xmlEscape(localized.defaultText)}</rdf:li>`);
  }
  for (const [lang, value] of Object.entries(localized.locales)) {
    if (lang === "x-default" || value.length === 0) continue;
    entries.push(`<rdf:li xml:lang="${xmlEscape(lang)}">${xmlEscape(value)}</rdf:li>`);
  }
  if (entries.length === 0) return "<rdf:Alt/>";
  return `<rdf:Alt>${entries.join("")}</rdf:Alt>`;
}

function renderField(f: XmpField): string {
  switch (f.kind) {
    case "text":
      return `<${f.tag}>${xmlEscape(f.value)}</${f.tag}>`;
    case "langalt":
      return `<${f.tag}>${buildLangAlt(f.value)}</${f.tag}>`;
    case "resource":
      return `<${f.tag} rdf:resource="${xmlEscape(f.href)}"/>`;
    case "seq":
      return `<${f.tag}><rdf:Seq>${f.items.map(v => `<rdf:li>${xmlEscape(v)}</rdf:li>`).join("")}</rdf:Seq></${f.tag}>`;
    case "bag":
      return `<${f.tag}><rdf:Bag>${f.items.map(v => `<rdf:li>${xmlEscape(v)}</rdf:li>`).join("")}</rdf:Bag></${f.tag}>`;
    case "bag-resource":
      return `<${f.tag}><rdf:Bag>${f.hrefs.map(h => `<rdf:li rdf:resource="${xmlEscape(h)}"/>`).join("")}</rdf:Bag></${f.tag}>`;
  }
}

interface XmpParams {
  readonly meta: Meta;
  readonly instanceID: XmpInstanceId;
}

function asStringOrEmpty(value: Undefinable<string> | null): string {
  return isNotUndefined(value) && isNotNull(value) ? value : "";
}

function nonEmptyItems(items: readonly string[]): NonEmptyArray<string> {
  const filtered = items.filter((item) => item.length > 0);
  return filtered.length > 0 ? [filtered[0] ?? "", ...filtered.slice(1)] : [""];
}

function buildXmp({ meta, instanceID }: XmpParams): string {
  const xmpDate = asStringOrEmpty(meta.dates.createdDateTime);

  const fields: XmpField[] = [
    { kind: "langalt",      tag: "dc:title",                   value: meta.text.title },
    { kind: "langalt",      tag: "dc:description",             value: meta.text.description },
    { kind: "seq",          tag: "dc:creator",                 items: nonEmptyItems([asStringOrEmpty(meta.text.creator)]) },
    { kind: "langalt",      tag: "dc:rights",                  value: meta.rights.rights },
    { kind: "bag",          tag: "dc:subject",                 items: nonEmptyItems(meta.keywords.flat) },
    { kind: "bag-resource", tag: "dc:type",                    hrefs: ["http://purl.org/dc/dcmitype/StillImage"] },
    { kind: "resource",     tag: "dcterms:license",            href: "http://rightsstatements.org/vocab/InC/1.0/" },
    { kind: "text",         tag: "xmpRights:Marked",           value: "True" },
    { kind: "bag",          tag: "xmpRights:Owner",            items: nonEmptyItems([asStringOrEmpty(meta.text.creator)]) },
    { kind: "langalt",      tag: "xmpRights:UsageTerms",       value: meta.rights.usageTerms },
    { kind: "text",         tag: "xmpRights:WebStatement",     value: asStringOrEmpty(meta.rights.webStatement) },
    { kind: "text",         tag: "xmp:CreatorTool",            value: meta.software },
    { kind: "text",         tag: "xmp:CreateDate",             value: xmpDate },
    { kind: "text",         tag: "photoshop:DateCreated",      value: xmpDate },
    { kind: "text",         tag: "photoshop:Credit",           value: asStringOrEmpty(meta.text.creator) },
    { kind: "text",         tag: "xmpMM:DocumentID",           value: asStringOrEmpty(meta.identity.documentID) },
    { kind: "text",         tag: "xmpMM:OriginalDocumentID",   value: asStringOrEmpty(meta.identity.originalDocumentID) },
    { kind: "text",         tag: "xmpMM:InstanceID",           value: instanceID },
  ];

  const indent = "      ";
  const body = fields.map(f => indent + renderField(f)).join("\n");

  // DerivedFrom is structurally unique (nested resource with mixed children) — kept as literal.
  const derivedFromDocId = asStringOrEmpty(meta.identity.documentID);
  const derivedFrom = `${indent}<xmpMM:DerivedFrom rdf:parseType="Resource">
        <stRef:filePath>avatar.svg</stRef:filePath>
        <stRef:documentID>${xmlEscape(derivedFromDocId)}</stRef:documentID>
      </xmpMM:DerivedFrom>`;

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:dcterms="http://purl.org/dc/terms/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
      xmlns:stRef="http://ns.adobe.com/xap/1.0/sType/ResourceRef#"
      xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
${body}
${derivedFrom}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function writeStable(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp`;
  const oldContent = existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
  if (oldContent === content) return;
  writeFileSync(tmpPath, content);
  renameSync(tmpPath, filePath);
  if (existsSync(tmpPath)) unlinkSync(tmpPath);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    throw new Error("Usage: bun run static/gen-avatar-xmp.ts <input.svg> <output.xmp> [primary-locale]");
  }
  const [inputSvgArg, outputXmpArg, primaryLocaleArg] = args;
  const inputSvg = asStringOrEmpty(inputSvgArg);
  const outputXmp = asStringOrEmpty(outputXmpArg);
  const primaryLocale = (primaryLocaleArg ?? process.env["META_PRIMARY_LOCALE"] ?? "en").trim() || "en";
  const reproducible = isNotUndefined(process.env["SOURCE_DATE_EPOCH"]);
  const inPath = resolve(dirname(fileURLToPath(import.meta.url)), inputSvg);
  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), outputXmp);
  const meta = extractMeta(inPath, primaryLocale);
  const instanceSeedDocId = asStringOrEmpty(meta.identity.documentID);
  const instanceID: XmpInstanceId = reproducible
    ? (`xmp.iid:${createHash("sha256").update(`${instanceSeedDocId}:${meta.text.title.defaultText}:${meta.text.description.defaultText}`).digest("hex").slice(0, 32)}` as XmpInstanceId)
    : (`xmp.iid:${randomUUID()}` as XmpInstanceId);
  const xmp = buildXmp({ meta, instanceID });
  writeStable(outPath, xmp);
}

main();
