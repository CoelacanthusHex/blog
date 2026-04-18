// svg-meta.ts — shared SVG metadata types and XML traversal utilities.

import { readFileSync } from "node:fs";
import { XmlParser, XmlElement, XmlText } from "xml-trueformat";
import type { XmlChildNode } from "xml-trueformat";
import { type Undefinable, isNotUndefined } from "option-t/undefinable";
import { andThenForUndefinable } from "option-t/undefinable/and_then";
import { unwrapOrForUndefinable } from "option-t/undefinable/unwrap_or";
import { orElseForUndefinable } from "option-t/undefinable/or_else";
import { Temporal } from "@js-temporal/polyfill";
import { type Nullable } from "option-t/nullable";

export type SvgFileName = string & { readonly __svgFileName: unique symbol };
export const svgFile = (name: string): SvgFileName => name as SvgFileName;

export interface LocalizedText {
  readonly defaultText: string;
  readonly locales: Readonly<Record<string, string>>;
}

export type NonEmptyString = string & { readonly __nonEmpty: unique symbol };
export type IsoDateOnly = string & { readonly __isoDateOnly: unique symbol };
export type IsoDateTimeWithOffset = string & { readonly __isoDateTimeWithOffset: unique symbol };
export type XmpDocumentId = string & { readonly __xmpDocumentId: unique symbol };
export type XmpInstanceId = string & { readonly __xmpInstanceId: unique symbol };
export type UuidUrn = string & { readonly __uuidUrn: unique symbol };
export type AssetIdentifier = string & { readonly __assetIdentifier: unique symbol };

function asOptionalNonEmptyString(value: string): Nullable<NonEmptyString> {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed as NonEmptyString : null;
}

function asOptionalIsoDateOnly(value: string): Nullable<IsoDateOnly> {
  const normalized = toDateOnly(value).trim();
  if (normalized.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Invalid ISO date-only value: ${normalized}`);
  }
  return normalized as IsoDateOnly;
}

function asOptionalIsoDateTimeWithOffset(value: string): Nullable<IsoDateTimeWithOffset> {
  const resolved = value.trim();
  if (resolved.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(resolved)) {
    throw new Error(`Invalid ISO datetime-with-offset value: ${resolved}`);
  }
  return resolved as IsoDateTimeWithOffset;
}

function asOptionalXmpDocumentId(value: string): Nullable<XmpDocumentId> {
  const resolved = value.trim();
  if (resolved.length === 0) return null;
  if (!/^xmp\.did:[0-9a-f-]+$/i.test(resolved) && resolved !== "xmp.did:avatar-svg") {
    throw new Error(`Invalid xmp document id: ${resolved}`);
  }
  return resolved as unknown as XmpDocumentId;
}

function asOptionalXmpInstanceId(value: string): Nullable<XmpInstanceId> {
  const resolved = value.trim();
  if (resolved.length === 0) return null;
  if (!/^xmp\.iid:[0-9a-f-]+$/i.test(resolved) && resolved !== "xmp.iid:avatar-svg") {
    throw new Error(`Invalid xmp instance id: ${resolved}`);
  }
  return resolved as unknown as XmpInstanceId;
}

function asUuidUrn(value: string): Nullable<UuidUrn> {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error(`Invalid UUID URN: ${trimmed}`);
  }
  return trimmed as UuidUrn;
}

function asAssetIdentifier(value: string): Nullable<AssetIdentifier> {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^urn:[a-z0-9][a-z0-9-]*:[\S]+$/i.test(trimmed)) {
    throw new Error(`Invalid asset identifier URN: ${trimmed}`);
  }
  return trimmed as AssetIdentifier;
}

export interface AvatarIdentity {
  readonly documentID: Nullable<XmpDocumentId>;
  readonly instanceID: Nullable<XmpInstanceId>;
  readonly originalDocumentID: Nullable<XmpDocumentId>;
  readonly identifier: Nullable<AssetIdentifier>;
  readonly digImageGUID: Nullable<UuidUrn>;
}

export interface AvatarRights {
  readonly rights: LocalizedText;
  readonly usageTerms: LocalizedText;
  readonly webStatement: Nullable<NonEmptyString>;
}

export interface AvatarText {
  readonly title: LocalizedText;
  readonly description: LocalizedText;
  readonly accessibilityAltText: LocalizedText;
  readonly creator: Nullable<NonEmptyString>;
}

export interface AvatarDates {
  readonly createdDateTime: Nullable<IsoDateTimeWithOffset>;
  readonly dateOnly: Nullable<IsoDateOnly>;
}

export interface AvatarKeywords {
  readonly flat: readonly string[];
  readonly hierarchical: readonly string[];
}

export interface AvatarMeta {
  readonly text: AvatarText;
  readonly rights: AvatarRights;
  readonly identity: AvatarIdentity;
  readonly keywords: AvatarKeywords;
  readonly dates: AvatarDates;
  readonly software: NonEmptyString;
}

function toNonEmptyString(value: string): Undefinable<string> {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coalesceLocalized(value: LocalizedText): LocalizedText {
  return {
    defaultText: unwrapOrForUndefinable(toNonEmptyString(value.defaultText), ""),
    locales: value.locales,
  };
}

function formatTemporalParts(year: number, month: number, day: number, hour: number, minute: number, second: number): string {
  return `${String(year).padStart(4, "0")}:${String(month).padStart(2, "0")}:${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

export function textContent(el: Undefinable<XmlElement>): string {
  if (!isNotUndefined(el)) return "";
  return el.children.map((c: XmlChildNode) => {
    if (c instanceof XmlText) return c.text;
    if (c instanceof XmlElement) return textContent(c);
    return "";
  }).join("");
}

export function getByLocal(el: Undefinable<XmlElement>, localName: string, skipEmpty = false): Undefinable<XmlElement> {
  if (!isNotUndefined(el)) return undefined;
  return el.children.find(
    (c): c is XmlElement =>
      c instanceof XmlElement &&
      (c.tagName === localName || c.tagName.endsWith(`:${localName}`)) &&
      (!skipEmpty || textContent(c).trim().length > 0)
  );
}

export function getByLocalPreferAlt(el: Undefinable<XmlElement>, localName: string): Undefinable<XmlElement> {
  if (!isNotUndefined(el)) return undefined;
  const all = el.children.filter(
    (c): c is XmlElement =>
      c instanceof XmlElement &&
      (c.tagName === localName || c.tagName.endsWith(`:${localName}`))
  );
  return all.find((c) => isNotUndefined(getByLocal(c, "Alt"))) ?? all[0];
}

export function makeLocalized(defaultText: string, primaryLocale: string): LocalizedText {
  const trimmed = defaultText.trim();
  return {
    defaultText: trimmed,
    locales: trimmed.length > 0 ? { [primaryLocale]: trimmed } : {},
  };
}

export function extractLangAlt(el: Undefinable<XmlElement>, primaryLocale: string): LocalizedText {
  if (!isNotUndefined(el)) return { defaultText: "", locales: {} };
  const alt = getByLocal(el, "Alt");
  if (!isNotUndefined(alt)) return makeLocalized(textContent(el), primaryLocale);

  const entries: Record<string, string> = {};
  for (const li of alt.children.filter((c): c is XmlElement => c instanceof XmlElement && (c.tagName === "rdf:li" || c.tagName.endsWith(":li")))) {
    const lang = unwrapOrForUndefinable(li.getAttributeValue("xml:lang"), "").trim();
    const value = textContent(li).trim();
    if (lang.length === 0 || value.length === 0) continue;
    if (!Object.prototype.hasOwnProperty.call(entries, lang)) {
      entries[lang] = value;
    }
  }

  const defaultText = unwrapOrForUndefinable(entries["x-default"] ?? Object.values(entries)[0], textContent(el).trim());
  return { defaultText, locales: entries };
}

function extractBagItems(el: Undefinable<XmlElement>): readonly string[] {
  const bag = getByLocal(el, "Bag") ?? getByLocal(el, "Seq");
  if (!isNotUndefined(bag)) return [];
  return bag.children
    .filter((c): c is XmlElement => c instanceof XmlElement && (c.tagName === "rdf:li" || c.tagName.endsWith(":li")))
    .map((li) => textContent(li).trim())
    .filter((v) => v.length > 0);
}

export function toDateOnly(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match?.[1] ?? (trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed);
}

export function toExifDateTime(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  const normalized = trimmed;
  if (/^\d{4}$/.test(normalized)) return `${normalized}:01:01 00:00:00`;

  const zonedInput = (() : Undefinable<Temporal.ZonedDateTime> => {
    try {
      return Temporal.ZonedDateTime.from(normalized);
    } catch {
      return undefined;
    }
  })();
  const zoned = andThenForUndefinable(
    zonedInput,
    (zdt): string => formatTemporalParts(zdt.year, zdt.month, zdt.day, zdt.hour, zdt.minute, zdt.second)
  );
  if (isNotUndefined(zoned)) return zoned;

  const plainDateTimeInput = (() : Undefinable<Temporal.PlainDateTime> => {
    try {
      return Temporal.PlainDateTime.from(normalized);
    } catch {
      return undefined;
    }
  })();
  const plainDateTime = andThenForUndefinable(
    plainDateTimeInput,
    (pdt): string => formatTemporalParts(pdt.year, pdt.month, pdt.day, pdt.hour, pdt.minute, pdt.second)
  );
  if (isNotUndefined(plainDateTime)) return plainDateTime;

  const plainDate = Temporal.PlainDate.from(normalized);
  return formatTemporalParts(plainDate.year, plainDate.month, plainDate.day, 0, 0, 0);
}

export function extractAvatarMeta(svgPath: string, primaryLocale: string): AvatarMeta {
  const content = readFileSync(svgPath, "utf8");
  const doc = XmlParser.parse(content);
  const svg = doc.getRootElement();

  const metadata = svg.getFirstElementByName("metadata");
  const rdfRDF = getByLocal(metadata, "RDF");
  const ccWork = orElseForUndefinable(getByLocal(rdfRDF, "Work"), () => getByLocal(rdfRDF, "Description"));
  const rdfDescription = getByLocal(rdfRDF, "Description");

  const rdfTitle = extractLangAlt(getByLocalPreferAlt(ccWork, "title"), primaryLocale);
  const rdfDescriptionText = extractLangAlt(getByLocalPreferAlt(ccWork, "description"), primaryLocale);
  const rights = extractLangAlt(getByLocalPreferAlt(ccWork, "rights"), primaryLocale);
  const usageTerms = extractLangAlt(getByLocalPreferAlt(ccWork, "UsageTerms"), primaryLocale);
  const accessibilityAltText = extractLangAlt(getByLocal(ccWork, "AltTextAccessibility"), primaryLocale);

  const createdDateTime = textContent(orElseForUndefinable(getByLocal(rdfDescription, "CreateDate"), () => getByLocal(ccWork, "created"))).trim();
  const dateOnly = toDateOnly(textContent(orElseForUndefinable(getByLocal(ccWork, "date"), () => getByLocal(ccWork, "created"))).trim());

  const creator = (
    textContent(getByLocal(ccWork, "creator", true)).trim() ||
    textContent(getByLocal(getByLocal(getByLocal(ccWork, "creator"), "Agent"), "title")).trim()
  );

  const documentID = asOptionalXmpDocumentId(textContent(getByLocal(rdfDescription, "DocumentID")).trim());
  const instanceID = asOptionalXmpInstanceId(textContent(getByLocal(rdfDescription, "InstanceID")).trim());
  const originalDocumentID = asOptionalXmpDocumentId(textContent(getByLocal(rdfDescription, "OriginalDocumentID")).trim());
  const digImageGUID = asUuidUrn(textContent(getByLocal(rdfDescription, "DigImageGUID")).trim());

  const identifierBag = extractBagItems(getByLocal(rdfDescription, "Identifier"));
  const dcIdentifierBag = extractBagItems(getByLocal(ccWork, "identifier"));
  const identifier = asAssetIdentifier(identifierBag[0] ?? dcIdentifierBag[0] ?? "");
  const webStatement = textContent(getByLocal(ccWork, "WebStatement")).trim();
  const keywords = extractBagItems(getByLocal(ccWork, "subject"));
  const hierarchicalKeywords = extractBagItems(getByLocal(ccWork, "Keywords"));

  return {
    text: {
      title: coalesceLocalized(rdfTitle),
      description: coalesceLocalized(rdfDescriptionText),
      accessibilityAltText: coalesceLocalized(accessibilityAltText),
      creator: asOptionalNonEmptyString(creator),
    },
    rights: {
      rights: coalesceLocalized(rights),
      usageTerms: coalesceLocalized(usageTerms),
      webStatement: asOptionalNonEmptyString(webStatement),
    },
    identity: {
      documentID,
      instanceID,
      originalDocumentID,
      identifier,
      digImageGUID,
    },
    keywords: {
      flat: keywords,
      hierarchical: hierarchicalKeywords,
    },
    dates: {
      createdDateTime: asOptionalIsoDateTimeWithOffset(createdDateTime),
      dateOnly: asOptionalIsoDateOnly(dateOnly),
    },
    software: "rsvg-convert" as NonEmptyString,
  };
}
