// configure-img.ts — generates build.ninja for avatar image pipeline.
// Run with: bun run static/configure-img.ts
// Then build with: ninja -C static
// FIXME: @ninjutsu-build/core 0.9.0 does not ship type definitions (dist/core.d.ts).
// A hand-crafted .d.ts has been added manually to node_modules/@ninjutsu-build/core/dist/core.d.ts
// and "types" added to its package.json as a workaround.
// Track: https://github.com/elliotgoodrich/ninjutsu-build/issues/112
// Remove the workaround once a fixed version is released.

// === Imports ===

import { NinjaBuilder, needs, orderOnlyDeps, implicitDeps, validations } from "@ninjutsu-build/core";
import { writeFileSync, mkdirSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type Nullable, isNotNull } from "option-t/nullable";
import { isNotUndefined } from "option-t/undefinable";
import { unwrapOrElseForUndefinable } from "option-t/undefinable/unwrap_or_else";
import { andThenForUndefinable } from "option-t/undefinable/and_then";
import { type SvgFileName, type AvatarMeta, svgFile, extractAvatarMeta, toExifDateTime } from "./svg-meta.ts";
import { quote } from "shell-quote";

// === Branded path types ===

/** Ninja-relative path (may contain $builddir variables). Never an absolute filesystem path. */
type NinjaPath = string & { readonly __ninjaPath: unique symbol };

const DIR = dirname(fileURLToPath(import.meta.url));
const filePath = (name: string): string => resolve(DIR, name);
const relPath = (name: string): NinjaPath => name as NinjaPath;
const buildPath = (name: string): NinjaPath => `$builddir/${name}` as NinjaPath;

const buildDirRel = ".ninja_build";
const buildDir = filePath(buildDirRel);
const buildNinjaPath = filePath("build.ninja");

// === Domain interfaces ===

type Meta = AvatarMeta;

interface Variant {
  readonly prefix: VariantPrefix;
  readonly svg: SvgFileName;
  readonly bg: readonly string[];
  readonly cicpPreset: string;
}

interface PoolDepths {
  readonly rsvg: number;
  readonly magick: number;
  readonly heavy: number;
}

// === Domain type aliases ===

type VariantPrefix =
  | "avatar"
  | "avatar-white-bg"
  | "avatar-round"
  | "avatar-round-white-bg"
  | "avatar-round-smaller"
  | "avatar-round-smaller-white-bg";

const SIZES = [16, 32, 48, 80, 128, 192, 256, 400, 512, 1024, 2048, 4096, 8192] as const;
type Size = (typeof SIZES)[number];

// === Generic sort utilities ===

type Comparator<T> = (a: T, b: T) => number;

class SortableArray<T> extends Array<T> {
  static override from<T>(values: readonly T[]): SortableArray<T> {
    const arr = new SortableArray<T>();
    arr.push(...values);
    return arr;
  }

  override filter(predicate: (value: T, index: number, array: T[]) => boolean): SortableArray<T> {
    return SortableArray.from(super.filter(predicate));
  }

  sortBy(compareFn: Comparator<T>): SortableArray<T> {
    return SortableArray.from([...this].sort(compareFn));
  }

  reversed(): SortableArray<T> {
    return SortableArray.from([...this].reverse());
  }

  unique(keyFn?: (value: T) => string): SortableArray<T> {
    if (keyFn === undefined) {
      return SortableArray.from([...new Set(this)]);
    }
    const seen = new Set<string>();
    return SortableArray.from(
      [...this].filter((value) => {
        const key = keyFn(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    );
  }
}

const stringComparator: Comparator<string> = (a, b) => a.localeCompare(b);
const numberComparator: Comparator<number> = (a, b) => a - b;
const variantComparator: Comparator<Variant> = (a, b) => a.prefix.localeCompare(b.prefix);

function toSortable<T>(values: readonly T[]): SortableArray<T> {
  return SortableArray.from(values);
}

function sortedUnique<T>(values: readonly T[], compareFn: Comparator<T>, keyFn?: (v: T) => string): T[] {
  return toSortable(values).unique(keyFn).sortBy(compareFn);
}

function uniqueSorted(values: readonly string[]): string[] {
  return sortedUnique(values, stringComparator);
}

function sortVariants(values: readonly Variant[]): Variant[] {
  return sortedUnique(values, variantComparator);
}

// === Pipeline constants ===

const ICO_SIZES: readonly number[] = [16, 32, 48] as const;
const FAVICON_VARIANT = "avatar-round" as const;
const CANONICAL_SIZE = 16384;
const MAX_STEP_RATIO = 32;
const MASKABLE_SIZES: readonly number[] = [192, 512] as const;

const RESERVED_PHONY_TARGETS = new Set([
  "png", "webp", "jxl", "jpeg", "favicon", "metadata", "ci-golden", "maskable", "full",
  "check-missingdeps", "check-commands", "check-graph",
]);

const VARIANTS: readonly Variant[] = [
  { prefix: "avatar",                        svg: svgFile("avatar.svg"),               bg: [],                                  cicpPreset: "srgb" },
  { prefix: "avatar-white-bg",               svg: svgFile("avatar.svg"),               bg: ["--background-color", "white"],     cicpPreset: "srgb" },
  { prefix: "avatar-round",                  svg: svgFile("avatar-round.svg"),         bg: [],                                  cicpPreset: "srgb" },
  { prefix: "avatar-round-white-bg",         svg: svgFile("avatar-round.svg"),         bg: ["--background-color", "white"],     cicpPreset: "srgb" },
  { prefix: "avatar-round-smaller",          svg: svgFile("avatar-round-smaller.svg"), bg: [],                                  cicpPreset: "srgb" },
  { prefix: "avatar-round-smaller-white-bg", svg: svgFile("avatar-round-smaller.svg"), bg: ["--background-color", "white"],     cicpPreset: "srgb" },
];


// === Ninja output registry ===

function registerOutput(registry: Set<NinjaPath>, output: NinjaPath): void {
  if (registry.has(output)) {
    throw new Error(`Duplicate output producer detected: ${output}`);
  }
  registry.add(output);
}

// === SVG metadata extraction ===

function extractMeta(svgPath: string, primaryLocale: string): Meta {
  return extractAvatarMeta(svgPath, primaryLocale);
}

// === Metadata serialization ===

function asStringOrEmpty(value: string | null | undefined): string {
  return andThenForUndefinable(value ?? undefined, (v) => v.length > 0 ? v : undefined) ?? "";
}

function makeExifCmdLines(m: Meta): string {
  const exifDate = toExifDateTime(asStringOrEmpty(m.dates.createdDateTime ?? m.dates.dateOnly));
  const xmpKeywords = m.keywords.flat.join(", ");
  const xmpHierKeywords = m.keywords.hierarchical.join(" | ");
  const fields: [string, string][] = [
    ["Exif.Image.Artist", asStringOrEmpty(m.text.creator)],
    ["Exif.Image.ImageDescription", m.text.description.defaultText],
    ["Exif.Image.Copyright", m.rights.rights.defaultText],
    ["Exif.Image.Software", asStringOrEmpty(m.software)],
    ["Exif.Image.DateTime", exifDate],
    ["Exif.Photo.DateTimeOriginal", exifDate],
    ["Exif.Photo.DateTimeDigitized", exifDate],
  ];
  const lines = fields
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `set ${k} Ascii ${v}`);
  lines.push(
    "set Exif.Image.XResolution Rational 96/1",
    "set Exif.Image.YResolution Rational 96/1",
    "set Exif.Image.ResolutionUnit Short 2",
    "set Exif.Image.Orientation Short 1",
    "set Exif.Photo.ColorSpace Short 1",
  );
  return lines.join("\n") + "\n";
}

function makePngTextArgs(m: Meta): string {
  const pairs: [string, string][] = [
    ["PNG:Title", m.text.title.defaultText],
    ["PNG:Description", m.text.description.defaultText],
    ["PNG:Author", asStringOrEmpty(m.text.creator)],
    ["PNG:Copyright", m.rights.rights.defaultText],
    ["PNG:Software", asStringOrEmpty(m.software)],
  ];
  return pairs
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `-${k}=${quote([v]).replace(/\\!/g, "!")}`)
    .join(" ");
}

// === Pool / graph helpers ===

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function computePoolDepths(): PoolDepths {
  const cpu = typeof navigator !== "undefined" && "hardwareConcurrency" in navigator
    ? (navigator.hardwareConcurrency || 4)
    : 4;
  const rsvg = 1;
  const magick = Math.max(1, Math.min(2, Math.floor(cpu / 8) || 1));
  const heavy = Math.max(1, Math.min(4, Math.floor(cpu / 4) || 1));
  return {
    rsvg: envInt("IMG_POOL_RSVG", rsvg),
    magick: envInt("IMG_POOL_MAGICK", magick),
    heavy: envInt("IMG_POOL_HEAVY", heavy),
  };
}

function intermediateFor(size: Size, sizes: readonly Size[]): Nullable<Size> {
  if (CANONICAL_SIZE / size <= MAX_STEP_RATIO) return null;
  const candidate = toSortable(sizes)
    .filter((s) => s >= size * 8 && s <= size * MAX_STEP_RATIO)
    .sortBy(numberComparator)
    .reversed()[0];
  return candidate ?? null;
}

function writeManifestAtomically(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

function ensureNoPhonyAliasCollision(outputs: readonly string[]): void {
  const outputSet = new Set(outputs);
  for (const alias of RESERVED_PHONY_TARGETS) {
    if (outputSet.has(alias)) {
      throw new Error(`Reserved phony target collides with real output: ${alias}`);
    }
  }
}


// === Setup: metadata, env, ninja builder ===

mkdirSync(buildDir, { recursive: true });
const primaryLocale = process.env["META_PRIMARY_LOCALE"] ?? "en";
const meta = extractMeta(filePath("avatar.svg"), primaryLocale);
const xmpFile = buildPath("avatar-meta.xmp");
const exifCmdFile = filePath(".ninja_build/avatar-exif.cmd");
const exifCmdNinjaPath = buildPath("avatar-exif.cmd");
writeFileSync(exifCmdFile, makeExifCmdLines(meta));
const pngTextArgs = makePngTextArgs(meta);
const toolThreads = process.env["IMG_TOOL_THREADS"] ?? "1";

const ninja = new NinjaBuilder({
  ninja_required_version: "1.13",
  builddir: buildDirRel,
});
ninja.variable("cjxl_threads", toolThreads);

const hasPngCicpEditor = isNotNull(Bun.which("png_cicp_editor"));
const hasExiftool = isNotNull(Bun.which("exiftool"));

// === Pools ===

const pools = computePoolDepths();
ninja.comment("=== Pools ===");
const rsvgPool = ninja.pool("rsvg", { depth: pools.rsvg });
const magickPool = ninja.pool("magick", { depth: pools.magick });
const heavyPool = ninja.pool("heavy", { depth: pools.heavy });

// === Rules ===

ninja.comment("=== Rules ===");

const genXmp = ninja.rule("gen_xmp", {
  command: "bun run gen-avatar-xmp.ts $in $out $locale",
  description: "generate XMP sidecar",
  out: needs<string>(),
  in: needs<string>(),
  locale: needs<string>(),
  restat: 1,
});

const rsvgConvert = ninja.rule("rsvg_convert", {
  command: "rsvg-convert $in $bg -w $size -h $size -a -o $out",
  description: "rsvg-convert $in -> $out ($size x $size)",
  out: needs<string>(),
  in: needs<string>(),
  bg: "",
  size: needs<string>(),
  pool: rsvgPool,
});

const magickEwa = ninja.rule("magick_ewa", {
  command: "magick $in -colorspace RGB -filter MagicKernelSharp2021 -distort Resize $size +repage -colorspace sRGB -depth 8 -define png:compression-level=9 -define png:compression-strategy=1 $out",
  description: "magick resize $in -> $out ($size)",
  out: needs<string>(),
  in: needs<string>(),
  size: needs<string>(),
  pool: magickPool,
});

const prepXmpSidecar = ninja.rule("prep_xmp_sidecar", {
  command: "cp $in $out",
  description: "prepare XMP sidecar $out",
  out: needs<string>(),
  in: needs<string>(),
  restat: 1,
});

const exiv2Meta = ninja.rule("exiv2_meta", {
  command: "exiv2 -m $cmdfile $in && exiv2 -i x -S .xmp -l $builddir $in && touch $out",
  description: "exiv2 Exif+XMP -> $in",
  out: needs<string>(),
  in: needs<string>(),
  cmdfile: needs<string>(),
  restat: 1,
});

const pngText = ninja.rule("png_text", {
  command: "./run-if-changed.sh $out $in exiftool -overwrite_original $args $in",
  description: "embed PNG iTXt into $in",
  out: needs<string>(),
  in: needs<string>(),
  args: needs<string>(),
  restat: 1,
});

const optipng = ninja.rule("optipng", {
  command: "./run-if-changed.sh $out $in optipng -o7 -zm1-9 -i 0 -preserve $in",
  description: "optipng -> $in",
  out: needs<string>(),
  in: needs<string>(),
  restat: 1,
});

const pngCicp = ninja.rule("png_cicp", {
  command: "./run-if-changed.sh $out $in png_cicp_editor add --preset $preset $in",
  description: "add cICP to $in",
  out: needs<string>(),
  in: needs<string>(),
  preset: needs<string>(),
  restat: 1,
});

const checkMetadata = ninja.rule("check_metadata", {
  command: "exiftool -s -s -s -ImageDescription -Artist -Copyright -XMP-dc:Title -XMP-dc:Description -XMP-xmpMM:DocumentID $in > /dev/null && touch $out",
  description: "check metadata $in",
  out: needs<string>(),
  in: needs<string>(),
  restat: 1,
});

const cjxl = ninja.rule("cjxl", {
  command: "cjxl --num_threads=$threads --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 --container=1 -x xmp=$xmp $in $out",
  description: "cjxl $in -> $out",
  out: needs<string>(),
  in: needs<string>(),
  xmp: needs<string>(),
  threads: "$cjxl_threads",
  pool: heavyPool,
});

const cwebp = ninja.rule("cwebp", {
  command: "cwebp -lossless -m 6 -mt -alpha_filter best -af -exact $in -o $out",
  description: "cwebp $in -> $out",
  out: needs<string>(),
  in: needs<string>(),
  pool: heavyPool,
});

const djxl = ninja.rule("djxl", {
  command: "djxl $in $out",
  description: "djxl $in -> $out",
  out: needs<string>(),
  in: needs<string>(),
  pool: heavyPool,
});

const magickIco = ninja.rule("magick_ico", {
  command: "magick $in $out",
  description: "magick ico $out",
  out: needs<string>(),
  in: needs<readonly string[]>(),
});

const symlinkRule = ninja.rule("symlink", {
  command: "ln -srf $target $out",
  description: "symlink $out -> $target",
  out: needs<string>(),
  target: needs<string>(),
  restat: 1,
});

const svgVariants = ninja.rule("svg_variants", {
  command: "bun run svg-variant.ts",
  description: "generate SVG variants",
  out: needs<readonly string[]>(),
  in: needs<readonly string[]>(),
  generator: 1,
  restat: 1,
});

const reconfigure = ninja.rule("reconfigure_img", {
  command: "bun run configure-img.ts",
  description: "reconfigure build.ninja",
  out: needs<string>(),
  in: needs<readonly string[]>(),
  generator: 1,
  pool: "console",
  restat: 1,
});

const checkMissingDepsRule = ninja.rule("check_missingdeps", {
  command: "ninja -t missingdeps full > /dev/null && touch $out",
  description: "check missingdeps(full)",
  out: needs<string>(),
  in: needs<readonly string[]>(),
  restat: 1,
});

const checkCommandsRule = ninja.rule("check_commands", {
  command: "ninja -t commands full > $out",
  description: "snapshot commands(full)",
  out: needs<string>(),
  in: needs<readonly string[]>(),
  restat: 1,
});


// === Build edges ===

ninja.comment("=== Build edges ===");
const outputRegistry = new Set<NinjaPath>();
const allOutputs: NinjaPath[] = [];
const pngOutputs: NinjaPath[] = [];
const webpOutputs: NinjaPath[] = [];
const jxlOutputs: NinjaPath[] = [];
const jpegOutputs: NinjaPath[] = [];
const metadataStamps: NinjaPath[] = [];
const ciGoldenOutputs: NinjaPath[] = [];
const variantOutputs = new Map<VariantPrefix, NinjaPath[]>();

const svgVariantOutputs = [
  "avatar-round.svg",
  "avatar-round-smaller.svg",
  "avatar-bimi.svg",
  "avatar.min.svg",
  "avatar-round.min.svg",
  "avatar-bimi.min.svg",
] as const;
for (const output of svgVariantOutputs) {
  registerOutput(outputRegistry, relPath(output));
}
void svgVariants({
  out: [...svgVariantOutputs],
  in: ["avatar.svg", "svg-variant.ts"],
});
const icoLayerStamps = new Map<number, string>();
const xmpOut = genXmp({ out: xmpFile, in: relPath("avatar.svg"), locale: primaryLocale });

for (const v of sortVariants(VARIANTS)) {
  ninja.comment(`--- ${v.prefix} ---`);

  const canonicalPng = buildPath(`${v.prefix}-canonical.png`);
  registerOutput(outputRegistry, canonicalPng);
  rsvgConvert({
    out: canonicalPng,
    in: relPath(v.svg),
    bg: v.bg.join(" "),
    size: CANONICAL_SIZE.toString(),
  });

  const pngMap = new Map<number, NinjaPath>();
  const sortedSizes = toSortable(SIZES).sortBy(numberComparator).reversed();
  const canonicalSizes = sortedSizes.filter((s) => !isNotNull(intermediateFor(s, SIZES)));
  const intermediateSizes = sortedSizes.filter((s) => isNotNull(intermediateFor(s, SIZES)));

  for (const size of canonicalSizes) {
    const outPng = relPath(`${v.prefix}-${String(size)}x${String(size)}.png`);
    registerOutput(outputRegistry, outPng);
    magickEwa({ out: outPng, in: canonicalPng, size: `${String(size)}x${String(size)}` });
    pngMap.set(size, outPng);
  }

  for (const size of intermediateSizes) {
    const src = intermediateFor(size, SIZES);
    if (!isNotNull(src)) throw new Error(`No intermediate found for size ${String(size)}`);
    const srcPng = unwrapOrElseForUndefinable(
      pngMap.get(src),
      () => { throw new Error(`Intermediate ${String(src)} not rasterized yet for size ${String(size)}`); }
    );
    const outPng = relPath(`${v.prefix}-${String(size)}x${String(size)}.png`);
    registerOutput(outputRegistry, outPng);
    magickEwa({ out: outPng, in: srcPng, size: `${String(size)}x${String(size)}` });
    pngMap.set(size, outPng);
  }

  for (const size of [...SIZES].sort((a, b) => a - b)) {
    const base = `${v.prefix}-${String(size)}x${String(size)}`;
    const png = relPath(`${base}.png`);
    const jxl = relPath(`${base}.jxl`);
    const jpeg = relPath(`${base}.jpg`);
    const webp = relPath(`${base}.webp`);

    registerOutput(outputRegistry, jxl);
    registerOutput(outputRegistry, jpeg);
    registerOutput(outputRegistry, webp);

    const pngMetaStamp = buildPath(`${base}.png.meta.stamp`);
    const pngTextStamp = buildPath(`${base}.png.text.stamp`);
    const pngOptStamp = buildPath(`${base}.png.opt.stamp`);
    const webpStamp = buildPath(`${base}.webp.meta.stamp`);
    const checkStamp = buildPath(`${base}.check.stamp`);
    const sidecarOut = buildPath(`${base}.xmp`);

    registerOutput(outputRegistry, pngMetaStamp);
    registerOutput(outputRegistry, pngTextStamp);
    registerOutput(outputRegistry, pngOptStamp);
    registerOutput(outputRegistry, webpStamp);
    registerOutput(outputRegistry, sidecarOut);

    const sidecarPrepOut = prepXmpSidecar({
      out: sidecarOut,
      in: xmpFile,
    });

    const pngTextOut = pngText({
      out: pngTextStamp,
      in: png,
      args: pngTextArgs,
    });

    const pngMetaOut = exiv2Meta({
      out: pngMetaStamp,
      in: png,
      cmdfile: exifCmdNinjaPath,
      [implicitDeps]: sidecarPrepOut,
      [orderOnlyDeps]: pngTextOut,
    });

    const pngCicpOut = hasPngCicpEditor
      ? pngCicp({
        out: buildPath(`${base}.png.cicp.stamp`),
        in: png,
        preset: v.cicpPreset,
        [orderOnlyDeps]: pngMetaOut,
      })
      : pngMetaOut;

    const pngOptOut = optipng({
      out: pngOptStamp,
      in: png,
      [orderOnlyDeps]: pngCicpOut,
      ...(hasExiftool && { [validations]: (): string => checkMetadata({ out: checkStamp, in: png }) }),
    });

    const jxlOut = cjxl({
      out: jxl,
      in: png,
      xmp: xmpFile,
      [implicitDeps]: xmpOut,
      [orderOnlyDeps]: pngOptOut,
    });

    const jpegOut = djxl({
      out: jpeg,
      in: jxl,
    });

    const webpRaw = cwebp({
      out: webp,
      in: png,
      [orderOnlyDeps]: pngOptOut,
    });

    const webpOut = exiv2Meta({
      out: webpStamp,
      in: webp,
      cmdfile: exifCmdNinjaPath,
      [implicitDeps]: sidecarPrepOut,
      [orderOnlyDeps]: webpRaw,
    });

    allOutputs.push(pngOptOut, jxlOut, webpOut);
    pngOutputs.push(pngOptOut);
    jxlOutputs.push(jxlOut);
    jpegOutputs.push(jpegOut);
    webpOutputs.push(webpOut);
    metadataStamps.push(pngMetaOut, pngTextOut, webpOut);

    const vOutputs = variantOutputs.get(v.prefix) ?? [];
    vOutputs.push(pngOptOut, jxlOut, webpOut);
    variantOutputs.set(v.prefix, vOutputs);

    if (v.prefix === FAVICON_VARIANT && ICO_SIZES.includes(size)) {
      icoLayerStamps.set(size, pngOptOut);
    }

    if (size === 256 || size === 1024) {
      ciGoldenOutputs.push(pngOptOut, jxlOut, jpegOut, webpOut);
    }
  }
}


// --- favicon.ico ---

ninja.comment("--- favicon.ico ---");
const icoLayers = [...ICO_SIZES].sort((a, b) => a - b).map(s => {
  unwrapOrElseForUndefinable(icoLayerStamps.get(s), () => { throw new Error(`ICO layer ${String(s)}px not found — ensure ${FAVICON_VARIANT} variant is built`); });
  return relPath(`${FAVICON_VARIANT}-${String(s)}x${String(s)}.png`);
});
const icoOptStamps = [...ICO_SIZES].sort((a, b) => a - b).map(s =>
  unwrapOrElseForUndefinable(icoLayerStamps.get(s), () => { throw new Error(`ICO opt stamp ${String(s)}px not found`); })
);
registerOutput(outputRegistry, relPath("favicon.ico"));
const faviconOut = magickIco({
  out: relPath("favicon.ico"),
  in: icoLayers,
  [orderOnlyDeps]: icoOptStamps,
});
allOutputs.push(faviconOut);

// --- maskable icons ---

ninja.comment("--- maskable icons ---");
const maskableOutputs: string[] = [];
for (const size of [...MASKABLE_SIZES].sort((a, b) => a - b)) {
  const target = relPath(`avatar-round-white-bg-${String(size)}x${String(size)}.png`);
  const out = relPath(`avatar-maskable-${String(size)}x${String(size)}.png`);
  const srcStamp = buildPath(`avatar-round-white-bg-${String(size)}x${String(size)}.png.opt.stamp`);
  registerOutput(outputRegistry, out);
  const maskOut = symlinkRule({
    out,
    target,
    [orderOnlyDeps]: srcStamp,
  });
  maskableOutputs.push(maskOut);
  allOutputs.push(maskOut);
}

// === Phony targets ===

const sortedAllOutputs = uniqueSorted(allOutputs);
const sortedPngOutputs = uniqueSorted(pngOutputs);
const sortedWebpOutputs = uniqueSorted(webpOutputs);
const sortedJxlOutputs = uniqueSorted(jxlOutputs);
const sortedJpegOutputs = uniqueSorted(jpegOutputs);
const sortedMetadataStamps = uniqueSorted(metadataStamps);
const sortedCiGoldenOutputs = uniqueSorted(ciGoldenOutputs);
const sortedMaskableOutputs = uniqueSorted(maskableOutputs);

const checkMissingDepsStamp = buildPath("check-missingdeps.stamp");
const checkCommandsOut = buildPath("full.commands.txt");
registerOutput(outputRegistry, checkMissingDepsStamp);
registerOutput(outputRegistry, checkCommandsOut);
checkMissingDepsRule({
  out: checkMissingDepsStamp,
  in: ["build.ninja"],
});
checkCommandsRule({
  out: checkCommandsOut,
  in: ["build.ninja"],
});

ensureNoPhonyAliasCollision(sortedAllOutputs);

ninja.phony({ out: "maskable",          in: sortedMaskableOutputs });
ninja.phony({ out: "png",               in: sortedPngOutputs });
ninja.phony({ out: "webp",              in: sortedWebpOutputs });
ninja.phony({ out: "jxl",               in: sortedJxlOutputs });
ninja.phony({ out: "jpeg",              in: sortedJpegOutputs });
ninja.phony({ out: "favicon",           in: faviconOut });
ninja.phony({ out: "metadata",          in: sortedMetadataStamps });
ninja.phony({ out: "ci-golden",         in: sortedCiGoldenOutputs });
ninja.phony({ out: "full",              in: sortedAllOutputs });
ninja.phony({ out: "check-missingdeps", in: checkMissingDepsStamp });
ninja.phony({ out: "check-commands",    in: checkCommandsOut });
ninja.phony({ out: "check-graph",       in: [checkMissingDepsStamp, checkCommandsOut] });

// Per-variant convenience targets: e.g. `ninja avatar-round`
for (const v of sortVariants(VARIANTS)) {
  const outputs = variantOutputs.get(v.prefix);
  if (isNotUndefined(outputs) && outputs.length > 0) {
    ninja.phony({ out: v.prefix, in: uniqueSorted(outputs) });
  }
}

// === Self-regeneration + output ===

// avatar-round.svg and avatar-round-smaller.svg are outputs of svg_variants,
// so ninja will run svg_variants before reconfigure_img on a clean build.
// configure-img.ts reads these files at runtime (parseViewBox), so the dep is real.
reconfigure({
  out: "build.ninja",
  in: ["configure-img.ts", "gen-avatar-xmp.ts", "svg-meta.ts", "run-if-changed.sh", "avatar.svg", "avatar-round.svg", "avatar-round-smaller.svg"],
});

ninja.comment("Diagnostics: ninja -t graph | ninja -t commands | ninja -d explain <target>");

ninja.default("full");
writeManifestAtomically(buildNinjaPath, ninja.output);
// eslint-disable-next-line no-console
console.log(`Wrote ${buildNinjaPath}`);
