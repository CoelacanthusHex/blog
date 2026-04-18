// SPDX-License-Identifier: MPL-2.0
// write-stable.ts — write a file only if content has changed, preserving mtime when unchanged.
//
// Preserving mtime is critical for Ninja's restat=1: if a generator step re-runs but produces
// identical output, Ninja skips all downstream steps whose only changed input was that file.
//
// Both variants use an atomic tmp-rename so a partial write is never visible to Ninja or other
// processes reading the file concurrently.

import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";

export async function writeStableAsync(path: string, content: string): Promise<void> {
  const existing = await readFile(path, "utf8").catch(() => null);
  if (existing === content) return;
  const tmp = `${path}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

export function writeStableSync(path: string, content: string): void {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (existing === content) return;
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}
