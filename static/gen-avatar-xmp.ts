// SPDX-License-Identifier: MPL-2.0
// gen-avatar-xmp.ts — generates a rendition-specific XMP sidecar.
// Inputs: encoded image, source SVG, Exif args, rendition key and locale.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isNotUndefined, type Undefinable } from "option-t/undefinable";
import { isNotNull } from "option-t/nullable";
import { BITMAP_MIME_TYPES, type AvatarMeta, type LocalizedText, type XmpDocumentId } from "./avatar-meta-types.ts";
import { contentInstanceID, documentIdentifier, renditionDocumentID, type ResourceReference } from "./avatar-identity.ts";
import { extractAvatarMeta } from "./svg-meta.ts";
import { writeStableSync } from "./write-stable.ts";

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

function asStringOrEmpty(value: Undefinable<string> | null): string {
  return isNotUndefined(value) && isNotNull(value) ? value : "";
}

function nonEmptyItems(items: readonly string[]): NonEmptyArray<string> {
  const filtered = items.filter((item) => item.length > 0);
  return filtered.length > 0 ? [filtered[0] ?? "", ...filtered.slice(1)] : [""];
}

type XmpField =
  | { kind: "text";         tag: XmpTag; value: string }
  | { kind: "langalt";      tag: XmpTag; value: LocalizedText }
  | { kind: "resource";     tag: XmpTag; href: string }
  | { kind: "seq";          tag: XmpTag; items: NonEmptyArray<string> }
  | { kind: "bag";          tag: XmpTag; items: NonEmptyArray<string> };

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
  }
}

interface XmpParams {
  readonly meta: AvatarMeta;
  readonly documentID: XmpDocumentId;
  readonly originalDocumentID: XmpDocumentId;
  readonly instanceID: string;
  readonly source: ResourceReference;
  readonly mime: `image/${string}`;
}

function buildXmp({ meta, documentID, originalDocumentID, instanceID, source, mime }: XmpParams): string {
  const xmpDate = asStringOrEmpty(meta.dates.createdDateTime);

  const fields: XmpField[] = [
    { kind: "langalt",      tag: "dc:title",                   value: meta.text.title },
    { kind: "langalt",      tag: "dc:description",             value: meta.text.description },
    { kind: "langalt",      tag: "iptc:AltTextAccessibility",   value: meta.text.accessibilityAltText },
    { kind: "seq",          tag: "dc:creator",                 items: nonEmptyItems([asStringOrEmpty(meta.text.creator)]) },
    { kind: "langalt",      tag: "dc:rights",                  value: meta.rights.rights },
    { kind: "bag",          tag: "dc:subject",                 items: nonEmptyItems(meta.keywords.flat) },
    { kind: "bag",          tag: "dc:type",                    items: ["http://purl.org/dc/dcmitype/StillImage"] },
    { kind: "text",         tag: "dc:format",                  value: mime },
    { kind: "text",         tag: "xmpRights:Marked",           value: "True" },
    { kind: "bag",          tag: "xmpRights:Owner",            items: nonEmptyItems([asStringOrEmpty(meta.text.creator)]) },
    { kind: "langalt",      tag: "xmpRights:UsageTerms",       value: meta.rights.usageTerms },
    { kind: "text",         tag: "xmpRights:WebStatement",     value: asStringOrEmpty(meta.rights.webStatement) },
    { kind: "text",         tag: "xmp:CreatorTool",            value: meta.software },
    { kind: "text",         tag: "xmp:CreateDate",             value: xmpDate },
    { kind: "text",         tag: "photoshop:DateCreated",      value: xmpDate },
    { kind: "text",         tag: "photoshop:Credit",           value: asStringOrEmpty(meta.text.creator) },
    { kind: "text",         tag: "xmpMM:DocumentID",           value: documentID },
    { kind: "text",         tag: "xmpMM:OriginalDocumentID",   value: originalDocumentID },
    { kind: "text",         tag: "xmpMM:InstanceID",           value: instanceID },
    { kind: "bag",          tag: "xmp:Identifier",             items: [documentIdentifier(documentID)] },
    { kind: "text",         tag: "dc:identifier",              value: documentIdentifier(documentID) },
  ];

  if (isNotNull(meta.rights.statement)) {
    fields.push({ kind: "resource", tag: "dcterms:rights", href: meta.rights.statement });
  }

  if (isNotNull(meta.rights.license)) {
    fields.push(
      { kind: "resource", tag: "cc:license", href: meta.rights.license },
      { kind: "resource", tag: "dcterms:license", href: meta.rights.license },
    );
  }

  if (isNotNull(meta.identity.digImageGUID)) {
    fields.push({ kind: "text", tag: "iptcExt:DigImageGUID", value: meta.identity.digImageGUID });
  }

  const indent = "      ";
  const body = fields.map(f => indent + renderField(f)).join("\n");

  // xmpMM:DerivedFrom has mixed children (file path, document and instance IDs), so it can't
  // be expressed as a plain XmpField variant — kept as a literal template string.
  const derivedFrom = `${indent}<xmpMM:DerivedFrom rdf:parseType="Resource">
        <stRef:filePath rdf:resource="${xmlEscape(source.filePath)}"/>
        <stRef:documentID>${xmlEscape(source.documentID)}</stRef:documentID>
        <stRef:instanceID>${xmlEscape(source.instanceID)}</stRef:instanceID>
      </xmpMM:DerivedFrom>`;

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:dcterms="http://purl.org/dc/terms/"
      xmlns:cc="http://creativecommons.org/ns#"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
      xmlns:stRef="http://ns.adobe.com/xap/1.0/sType/ResourceRef#"
      xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
      xmlns:iptc="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
      xmlns:iptcExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
${body}
${derivedFrom}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function main(): void {
  const args = process.argv.slice(2);
  const [input, output, sourceSvg, variant, sizeArg, mime, argsFile, locale = "en"] = args;
  if (input === undefined || output === undefined || sourceSvg === undefined || variant === undefined ||
      sizeArg === undefined || mime === undefined || argsFile === undefined || args.length > 8 ||
      args.slice(0, 7).some(arg => arg.length === 0)) {
    throw new Error("Usage: gen-avatar-xmp.ts <encoded-image> <output.xmp> <source.svg> <variant> <size> <mime> <exif-args> [locale]");
  }
  const size = Number(sizeArg);
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error(`Invalid rendition size: ${sizeArg}`);
  }
  const mimeType = Object.values(BITMAP_MIME_TYPES).find(value => value === mime);
  if (mimeType === undefined) {
    throw new Error(`Unsupported bitmap MIME type: ${mime}`);
  }

  const filePath = (path: string): string => resolve(import.meta.dirname, path);
  const meta = extractAvatarMeta(filePath(sourceSvg), locale);
  const { documentID: sourceDocumentID, instanceID: sourceInstanceID } = meta.identity;
  if (sourceDocumentID === null || sourceInstanceID === null) {
    throw new Error(`Missing source identity in ${sourceSvg}`);
  }
  const originalDocumentID = meta.identity.originalDocumentID ?? sourceDocumentID;
  const documentID = renditionDocumentID(originalDocumentID, { variant, dimensions: [size, size], mime: mimeType });
  const params = {
    meta, documentID, originalDocumentID, mime: mimeType,
    source: { documentID: sourceDocumentID, instanceID: sourceInstanceID, filePath: sourceSvg },
  } satisfies Omit<XmpParams, "instanceID">;
  const instanceID = contentInstanceID(documentID, [
    readFileSync(filePath(input)),
    buildXmp({ ...params, instanceID: "" }),
    readFileSync(filePath(argsFile)),
  ]);
  writeStableSync(filePath(output), buildXmp({ ...params, instanceID }));
}

main();
