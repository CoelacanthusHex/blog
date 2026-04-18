// SPDX-License-Identifier: MPL-2.0
// avatar-meta-types.ts — branded types and interfaces for avatar SVG metadata.
// Imported by all scripts that work with avatar metadata; has no heavy dependencies.

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
