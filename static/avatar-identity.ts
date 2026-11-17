// SPDX-License-Identifier: MPL-2.0
// Rendition identity is stable; instance identity describes reproducible content.

import { createHash } from "node:crypto";
import { v5 as uuidv5 } from "uuid";
import type { AssetIdentifier, XmpDocumentId, XmpInstanceId } from "./avatar-meta-types.ts";

const IDENTITY_SCHEME = "avatar-identity-v1";
const DOCUMENT_PREFIX = "xmp.did:";

export interface RenditionKey {
  readonly variant: string;
  readonly dimensions: readonly [number, number] | "scalable";
  readonly mime: `image/${string}`;
}

export interface ResourceReference {
  readonly documentID: XmpDocumentId;
  readonly instanceID: XmpInstanceId;
  readonly filePath: string;
}

export function renditionDocumentID(original: XmpDocumentId, key: RenditionKey): XmpDocumentId {
  const name = JSON.stringify([IDENTITY_SCHEME, "document", key.variant, key.dimensions, key.mime]);
  return `${DOCUMENT_PREFIX}${uuidv5(name, uuidv5(original, uuidv5.URL))}` as XmpDocumentId;
}

export function documentIdentifier(documentID: XmpDocumentId): AssetIdentifier {
  return `urn:uuid:${documentID.slice(DOCUMENT_PREFIX.length)}` as AssetIdentifier;
}

/** Exclude the instance ID itself from content to avoid a circular hash. */
export function contentInstanceID(documentID: XmpDocumentId, content: readonly (string | Uint8Array)[]): XmpInstanceId {
  const digests = content.map(part => createHash("sha256").update(part).digest("hex"));
  const name = JSON.stringify([IDENTITY_SCHEME, "instance", digests]);
  return `xmp.iid:${uuidv5(name, uuidv5(documentID, uuidv5.URL))}` as XmpInstanceId;
}
