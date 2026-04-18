// SPDX-License-Identifier: MPL-2.0
// configure-img.ts — generates build.ninja for avatar image pipeline.
// Run with: bun run static/configure-img.ts
// Then build with: ninja -C static
// FIXME: @ninjutsu-build/core 0.9.0 does not ship type definitions (dist/core.d.ts).
// A hand-crafted .d.ts has been added manually to node_modules/@ninjutsu-build/core/dist/core.d.ts
// and "types" added to its package.json as a workaround.
// Track: https://github.com/elliotgoodrich/ninjutsu-build/issues/112
// Remove the workaround once a fixed version is released.

import { NinjaBuilder, orderOnlyDeps, implicitDeps } from "@ninjutsu-build/core";
import { writeFileSync, mkdirSync, renameSync } from "node:fs";
import which from "which";
import { resolve } from "node:path";
import { type Nullable, isNotNull } from "option-t/nullable";
import { isNotUndefined } from "option-t/undefinable";
import { unwrapOrElseForUndefinable } from "option-t/undefinable/unwrap_or_else";
import { type AvatarMeta } from "./avatar-meta-types.ts";
import { extractAvatarMeta, toExifDateTime } from "./svg-meta.ts";
import { writeStableSync } from "./write-stable.ts";
import { computePoolDepths, defineImgRules } from "./ninja-img-rules.ts";

/** Ninja-relative path (may contain $builddir variables). Never an absolute filesystem path. */
type NinjaPath = string & { readonly __ninjaPath: unique symbol };

const DIR = import.meta.dirname;
const filePath = (name: string): string => resolve(DIR, name);
const relPath = (name: string): NinjaPath => name as NinjaPath;
const buildPath = (name: string): NinjaPath => `$builddir/${name}` as NinjaPath;

const buildDirRel = ".ninja_build";
const buildDir = filePath(buildDirRel);
const buildNinjaPath = filePath("build.ninja");


interface Variant {
  readonly prefix: VariantPrefix;
  readonly svg: NinjaPath;
  readonly bg: readonly string[];
  readonly cicpPreset: string;
}

type VariantPrefix =
  | "avatar"
  | "avatar-white-bg"
  | "avatar-maskable"
  | "avatar-maskable-white-bg"
  | "avatar-maskable-shadow"
  | "avatar-maskable-shadow-white-bg";

const SIZES = [16, 32, 48, 80, 128, 192, 256, 400, 512, 1024, 2048, 4096, 8192] as const;
type Size = (typeof SIZES)[number];

type Comparator<T> = (a: T, b: T) => number;

const stringComparator: Comparator<string> = (a, b) => a.localeCompare(b);
const numberComparator: Comparator<number> = (a, b) => a - b;
const variantComparator: Comparator<Variant> = (a, b) => a.prefix.localeCompare(b.prefix);

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(stringComparator);
}

function sortVariants(values: readonly Variant[]): Variant[] {
  return [...new Set(values)].sort(variantComparator);
}

const ICO_SIZES: readonly number[] = [16, 32, 48] as const;
const FAVICON_VARIANT = "avatar-maskable" as const;
const CANONICAL_SIZE = 16384;
const MAX_STEP_RATIO = 32;
const MASKABLE_SIZES: readonly number[] = [192, 512] as const;

const RESERVED_PHONY_TARGETS = new Set([
  "png", "webp", "jxl", "jpeg", "favicon", "metadata", "ci-golden", "maskable", "full",
  "check-missingdeps", "check-commands", "check-graph", "compare-quality",
]);

const VARIANTS: readonly Variant[] = [
  { prefix: "avatar",                        svg: relPath("avatar.image.svg"),                              bg: [],                                  cicpPreset: "srgb" },
  { prefix: "avatar-white-bg",               svg: relPath("avatar.image.svg"),                              bg: ["--background-color", "white"],     cicpPreset: "srgb" },
  { prefix: "avatar-maskable",                  svg: buildPath("avatar-maskable.image.svg"),                      bg: [],                                  cicpPreset: "srgb" },
  { prefix: "avatar-maskable-white-bg",         svg: buildPath("avatar-maskable.image.svg"),                      bg: ["--background-color", "white"],     cicpPreset: "srgb" },
  { prefix: "avatar-maskable-shadow",          svg: buildPath("avatar-maskable-shadow.image.svg"),              bg: [],                                  cicpPreset: "srgb" },
  { prefix: "avatar-maskable-shadow-white-bg", svg: buildPath("avatar-maskable-shadow.image.svg"),              bg: ["--background-color", "white"],     cicpPreset: "srgb" },
];

function registerOutput(registry: Set<NinjaPath>, output: NinjaPath): void {
  if (registry.has(output)) {
    throw new Error(`Duplicate output producer detected: ${output}`);
  }
  registry.add(output);
}

function asStringOrEmpty(value: string | null | undefined): string {
  return (value !== null && value !== undefined && value.length > 0) ? value : "";
}

/** Generate unified exiftool -@ argfile covering Exif IFD + PNG iTXt fields.
 *  XMP is handled separately via -tagsfromfile $xmp -XMP:all.
 *  One argument per line, no shell quoting — exiftool reads values literally. */
function makeMetaArgsFile(m: AvatarMeta): string {
  const exifDate = toExifDateTime(asStringOrEmpty(m.dates.createdDateTime ?? m.dates.dateOnly));
  const pairs: [string, string][] = [
    // Exif IFD fields
    ["-Artist",            asStringOrEmpty(m.text.creator)],
    ["-ImageDescription",  m.text.description.defaultText],
    ["-Copyright",         m.rights.rights.defaultText],
    ["-Software",          asStringOrEmpty(m.software)],
    ["-DateTime",          exifDate],
    ["-DateTimeOriginal",  exifDate],
    ["-DateTimeDigitized", exifDate],
    // PNG iTXt text chunks (ignored by exiftool for non-PNG formats)
    ["-PNG:Title",         m.text.title.defaultText],
    ["-PNG:Description",   m.text.description.defaultText],
    ["-PNG:Author",        asStringOrEmpty(m.text.creator)],
    ["-PNG:Copyright",     m.rights.rights.defaultText],
    ["-PNG:Software",      asStringOrEmpty(m.software)],
  ];
  const lines = pairs
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}=${v}`);
  lines.push(
    "-XResolution=96",
    "-YResolution=96",
    "-ResolutionUnit=inches",
    "-Orientation=Horizontal (normal)",
    "-ColorSpace=sRGB",
  );
  return lines.join("\n") + "\n";
}

function intermediateFor(size: Size, sizes: readonly Size[]): Nullable<Size> {
  if (CANONICAL_SIZE / size <= MAX_STEP_RATIO) return null;
  const candidate = [...sizes]
    .filter((s) => s >= size * 8 && s <= size * MAX_STEP_RATIO)
    .sort(numberComparator)
    .at(-1);
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


mkdirSync(buildDir, { recursive: true });
const primaryLocale = process.env["META_PRIMARY_LOCALE"] ?? "en";
const meta = extractAvatarMeta(filePath("avatar.metadata.svg"), primaryLocale);
const xmpFile = buildPath("avatar-meta.xmp");
const metaArgsFile = filePath(".ninja_build/avatar-meta.args");
const metaArgsNinjaPath = buildPath("avatar-meta.args");
writeStableSync(metaArgsFile, makeMetaArgsFile(meta));
const toolThreads = process.env["IMG_TOOL_THREADS"] ?? "1";

const ninja = new NinjaBuilder({
  ninja_required_version: "1.13",
  builddir: buildDirRel,
});
ninja.variable("cjxl_threads", toolThreads);

const hasPngCicpEditor = isNotNull(which.sync("png_cicp_editor", { nothrow: true }));
// Build it with: bash build-ssimulacra2.sh
const ssimulacra2Path = relPath("./ssimulacra2");
const hasSsimulacra2 = isNotNull(which.sync(filePath("ssimulacra2"), { nothrow: true }));
if (!isNotNull(which.sync("exiftool", { nothrow: true }))) {
  throw new Error("exiftool is required but not found in PATH");
}

const {
  genXmp, rsvgConvert, magickEwa, pngOptimize, embedMetadata, reflinkCopy,
  cjxl, cwebp, cjpegli, magickIco, symlinkRule,
  svgVariants, svgMerge, reconfigure,
  checkMissingDepsRule, checkCommandsRule,
  measureQuality, measureSsimu2, reportQuality, genQualityScript, gnuplotRule,
  decodeToPng, avifenc, heifEnc, opjCompress,
} = defineImgRules(ninja, computePoolDepths());


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
  buildPath("avatar-maskable.image.svg"),
  buildPath("avatar-maskable-shadow.image.svg"),
  relPath("avatar-bimi.svg"),
] as const;
for (const output of svgVariantOutputs) {
  registerOutput(outputRegistry, output);
}
void svgVariants({
  out: [...svgVariantOutputs],
  in: ["avatar.image.svg", "svg-variant.ts"],
});

const svgMergeOutputs = [
  "avatar.svg",
  "avatar-maskable.svg",
  "avatar-maskable-shadow.svg",
  "avatar.min.svg",
  "avatar-maskable.min.svg",
  "avatar-maskable-shadow.min.svg",
  "avatar-bimi.min.svg",
] as const;
for (const output of svgMergeOutputs) {
  registerOutput(outputRegistry, relPath(output));
  allOutputs.push(relPath(output))
}
void svgMerge({
  out: [...svgMergeOutputs],
  in: [buildPath("avatar-maskable.image.svg"), buildPath("avatar-maskable-shadow.image.svg"), "avatar.image.svg", "avatar-bimi.svg", "avatar.metadata.svg", "svg-merge.ts"],
});

const icoLayerStamps = new Map<number, string>();
const xmpOut = genXmp({ out: xmpFile, in: relPath("avatar.metadata.svg"), locale: primaryLocale });

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
  const sortedSizes = [...SIZES].sort((a, b) => b - a);
  const canonicalSizes = sortedSizes.filter((s) => !isNotNull(intermediateFor(s, SIZES)));
  const intermediateSizes = sortedSizes.filter((s) => isNotNull(intermediateFor(s, SIZES)));

  for (const size of canonicalSizes) {
    const rawPng = buildPath(`${v.prefix}-${String(size)}x${String(size)}.raw.png`);
    registerOutput(outputRegistry, rawPng);
    magickEwa({ out: rawPng, in: canonicalPng, size: `${String(size)}x${String(size)}` });
    pngMap.set(size, rawPng);
  }

  for (const size of intermediateSizes) {
    const src = intermediateFor(size, SIZES);
    if (!isNotNull(src)) throw new Error(`No intermediate found for size ${String(size)}`);
    const srcPng = unwrapOrElseForUndefinable(
      pngMap.get(src),
      () => { throw new Error(`Intermediate ${String(src)} not rasterized yet for size ${String(size)}`); }
    );
    const rawPng = buildPath(`${v.prefix}-${String(size)}x${String(size)}.raw.png`);
    registerOutput(outputRegistry, rawPng);
    magickEwa({ out: rawPng, in: srcPng, size: `${String(size)}x${String(size)}` });
    pngMap.set(size, rawPng);
  }

  for (const size of [...SIZES].sort((a, b) => a - b)) {
    const base = `${v.prefix}-${String(size)}x${String(size)}`;
    const rawPng   = buildPath(`${base}.raw.png`);    // raster output (image-only dep)
    const pubPng   = relPath(`${base}.png`);           // public PNG (final reflink)
    const pubWebp  = relPath(`${base}.webp`);          // public WebP (final reflink)
    const jxl      = relPath(`${base}.jxl`);
    const jpeg     = relPath(`${base}.jpg`);

    registerOutput(outputRegistry, pubPng);
    registerOutput(outputRegistry, pubWebp);
    registerOutput(outputRegistry, jxl);
    registerOutput(outputRegistry, jpeg);

    // === Image-only chain (no metadata deps) ===

    const optPng = buildPath(`${base}.opt.png`);
    registerOutput(outputRegistry, optPng);
    const optPngOut = pngOptimize({
      out: optPng,
      in: rawPng,
      cicp_cmd: hasPngCicpEditor ? ` && png_cicp_editor add --preset ${v.cicpPreset} $out` : "",
    });

    // JXL, JPEG and WebP encode from rawPng — run fully in parallel with optimize+metadata chain.
    const rawJxl = buildPath(`${base}.raw.jxl`);
    registerOutput(outputRegistry, rawJxl);
    cjxl({ out: rawJxl, in: rawPng });

    // JPEG encoded directly from rawPng via cjpegli (no JXL round-trip)
    // 27% smaller than djxl q95 at virtually identical perceptual quality
    const rawJpeg = buildPath(`${base}.raw.jpg`);
    registerOutput(outputRegistry, rawJpeg);
    cjpegli({ out: rawJpeg, in: rawPng });

    const rawWebp = buildPath(`${base}.raw.webp`);
    registerOutput(outputRegistry, rawWebp);
    cwebp({ out: rawWebp, in: rawPng });

    // === Metadata chain (depends on avatar.metadata.svg) ===
    // All formats use the same embedMetadata rule (exiftool only, no exiv2).
    // metaArgsNinjaPath and xmpFile are implicit deps — stable mtimes prevent re-runs.

    // PNG: opt.png → final.png → public.png
    const finalPng = buildPath(`${base}.final.png`);
    registerOutput(outputRegistry, finalPng);
    const finalPngOut = embedMetadata({
      out: finalPng,
      in: optPngOut,
      argsfile: metaArgsNinjaPath,
      xmp: xmpFile,
      [implicitDeps]: [metaArgsNinjaPath, xmpOut],
    });
    const pubPngOut = reflinkCopy({ out: pubPng, in: finalPngOut });

    // JXL: raw.jxl → final.jxl → public.jxl
    const finalJxl = buildPath(`${base}.final.jxl`);
    registerOutput(outputRegistry, finalJxl);
    const finalJxlOut = embedMetadata({
      out: finalJxl,
      in: rawJxl,
      argsfile: metaArgsNinjaPath,
      xmp: xmpFile,
      [implicitDeps]: [metaArgsNinjaPath, xmpOut],
    });
    const jxlOut = reflinkCopy({ out: jxl, in: finalJxlOut });

    // JPEG: raw.jpg → final.jpg → public.jpg
    const finalJpeg = buildPath(`${base}.final.jpg`);
    registerOutput(outputRegistry, finalJpeg);
    const finalJpegOut = embedMetadata({
      out: finalJpeg,
      in: rawJpeg,
      argsfile: metaArgsNinjaPath,
      xmp: xmpFile,
      [implicitDeps]: [metaArgsNinjaPath, xmpOut],
    });
    const jpegOut = reflinkCopy({ out: jpeg, in: finalJpegOut });

    // WebP: raw.webp → final.webp → public.webp
    const finalWebp = buildPath(`${base}.final.webp`);
    registerOutput(outputRegistry, finalWebp);
    const finalWebpOut = embedMetadata({
      out: finalWebp,
      in: rawWebp,
      argsfile: metaArgsNinjaPath,
      xmp: xmpFile,
      [implicitDeps]: [metaArgsNinjaPath, xmpOut],
    });
    const pubWebpOut = reflinkCopy({ out: pubWebp, in: finalWebpOut });

    allOutputs.push(pubPngOut, jxlOut, pubWebpOut);
    pngOutputs.push(pubPngOut);
    jxlOutputs.push(jxlOut);
    jpegOutputs.push(jpegOut);
    webpOutputs.push(pubWebpOut);
    metadataStamps.push(finalPngOut, finalJxlOut, finalJpegOut, finalWebpOut);

    const vOutputs = variantOutputs.get(v.prefix) ?? [];
    vOutputs.push(pubPngOut, jxlOut, pubWebpOut);
    variantOutputs.set(v.prefix, vOutputs);

    if (v.prefix === FAVICON_VARIANT && ICO_SIZES.includes(size)) {
      icoLayerStamps.set(size, rawPng);
    }

    if (size === 256 || size === 1024) {
      ciGoldenOutputs.push(pubPngOut, jxlOut, jpegOut, pubWebpOut);
    }
  }
}


ninja.comment("--- favicon.ico ---");
const icoLayers = [...ICO_SIZES].sort((a, b) => a - b).map(s =>
  unwrapOrElseForUndefinable(icoLayerStamps.get(s), () => { throw new Error(`ICO layer ${String(s)}px not found — ensure ${FAVICON_VARIANT} variant is built`); })
);
registerOutput(outputRegistry, relPath("favicon.ico"));
const faviconOut = magickIco({
  out: relPath("favicon.ico"),
  in: icoLayers,
});
allOutputs.push(faviconOut);

const sortedAllOutputs = uniqueSorted(allOutputs);
const sortedPngOutputs = uniqueSorted(pngOutputs);
const sortedWebpOutputs = uniqueSorted(webpOutputs);
const sortedJxlOutputs = uniqueSorted(jxlOutputs);
const sortedJpegOutputs = uniqueSorted(jpegOutputs);
const sortedMetadataStamps = uniqueSorted(metadataStamps);
const sortedCiGoldenOutputs = uniqueSorted(ciGoldenOutputs);

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
// --- compare-quality: parallel per-file measurements + aggregated report ---
// Each (variant, size, format) gets measure_quality (ffmpeg) + optional measure_ssimu2 edges.
// report_quality merges all .quality and .ssimu2 files into one table.
ninja.comment("--- compare-quality ---");
const allQualityInputs: NinjaPath[] = [];
const allExtraQualityInputs: NinjaPath[] = [];
const CI_GOLDEN_SIZES_CQ = [256, 1024] as const;
for (const v of sortVariants(VARIANTS)) {
  for (const size of CI_GOLDEN_SIZES_CQ) {
    const base = `${v.prefix}-${String(size)}x${String(size)}`;
    const ref  = buildPath(`${base}.raw.png`);
    for (const fmt of ["png", "jpg", "jxl", "webp"] as const) {
      const pub = relPath(`${base}.${fmt}`);
      const qualityOut = buildPath(`${base}.${fmt}.quality`);
      registerOutput(outputRegistry, qualityOut);
      measureQuality({ out: qualityOut, in: pub, ref });
      allQualityInputs.push(qualityOut);
      if (hasSsimulacra2) {
        const ssimu2In = fmt === "webp"
          ? (() : NinjaPath => {
              const decoded = buildPath(`${base}.decoded.png`);
              registerOutput(outputRegistry, decoded);
              decodeToPng({ out: decoded, in: pub });
              return decoded;
            })()
          : pub;
        const ssimu2Out = buildPath(`${base}.${fmt}.ssimu2`);
        registerOutput(outputRegistry, ssimu2Out);
        measureSsimu2({ out: ssimu2Out, in: ssimu2In, ref, ssimu2: ssimulacra2Path });
        allQualityInputs.push(ssimu2Out);
      }
    }
  }
}

// --- compare-quality-extra: AVIF, HEIC, JP2 — encode+measure only, not in default targets ---
ninja.comment("--- compare-quality-extra ---");
// rawPng map: base → rawPng path, built during the main variant loop above.
// We re-derive the paths here since rawPng is local to the loop scope.
for (const v of sortVariants(VARIANTS)) {
  for (const size of CI_GOLDEN_SIZES_CQ) {
    const base = `${v.prefix}-${String(size)}x${String(size)}`;
    const ref  = buildPath(`${base}.raw.png`);
    const extraFmts = [
      { fmt: "avif", ext: "avif", encode: (i: NinjaPath, o: NinjaPath): NinjaPath => avifenc({ out: o, in: i }) },
      { fmt: "heic", ext: "heic", encode: (i: NinjaPath, o: NinjaPath): NinjaPath => heifEnc({ out: o, in: i }) },
      { fmt: "jp2",  ext: "jp2",  encode: (i: NinjaPath, o: NinjaPath): NinjaPath => opjCompress({ out: o, in: i }) },
    ] as const;
    for (const { fmt, ext, encode } of extraFmts) {
      const rawOut  = buildPath(`${base}.raw.${ext}`);
      registerOutput(outputRegistry, rawOut);
      encode(ref, rawOut);

      const qualityOut = buildPath(`${base}.${fmt}.quality`);
      registerOutput(outputRegistry, qualityOut);
      measureQuality({ out: qualityOut, in: rawOut, ref });
      allExtraQualityInputs.push(qualityOut);

      if (hasSsimulacra2) {
        // Decode to PNG for ssimulacra2 (doesn't support AVIF/HEIC/JP2 directly).
        const decoded = buildPath(`${base}.${fmt}.decoded.png`);
        registerOutput(outputRegistry, decoded);
        decodeToPng({ out: decoded, in: rawOut });
        const ssimu2Out = buildPath(`${base}.${fmt}.ssimu2`);
        registerOutput(outputRegistry, ssimu2Out);
        measureSsimu2({ out: ssimu2Out, in: decoded, ref, ssimu2: ssimulacra2Path });
        allExtraQualityInputs.push(ssimu2Out);
      }
    }
  }
}
const allCombinedQualityInputs = uniqueSorted([...allQualityInputs, ...allExtraQualityInputs]);
const reportQualityOut = buildPath("compare-quality.txt");
registerOutput(outputRegistry, reportQualityOut);
reportQuality({
  out: reportQualityOut,
  in: ["compare-quality.ts", ...allCombinedQualityInputs],
});

let plotQualityOut: NinjaPath | undefined;
if (hasSsimulacra2) {
  plotQualityOut = buildPath("compare-quality.pdf");
  const scriptOut = buildPath("compare-quality.gnuplot");
  registerOutput(outputRegistry, scriptOut);
  registerOutput(outputRegistry, plotQualityOut);
  genQualityScript({
    out: scriptOut,
    in: ["compare-quality.ts", ...allCombinedQualityInputs],
  });
  gnuplotRule({
    out: plotQualityOut,
    in: scriptOut,
  });
}

ensureNoPhonyAliasCollision(sortedAllOutputs);

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
ninja.phony({ out: "compare-quality",   in: isNotUndefined(plotQualityOut) ? [reportQualityOut, plotQualityOut] : reportQualityOut });

// Per-variant convenience targets: e.g. `ninja avatar-maskable`
for (const v of sortVariants(VARIANTS)) {
  const outputs = variantOutputs.get(v.prefix);
  if (isNotUndefined(outputs) && outputs.length > 0) {
    ninja.phony({ out: v.prefix, in: uniqueSorted(outputs) });
  }
}

reconfigure({
  out: "build.ninja",
  in: ["configure-img.ts", "ninja-img-rules.ts", "gen-avatar-xmp.ts", "svg-meta.ts", "avatar-meta-types.ts", "write-stable.ts", "run-if-changed.sh", "avatar.image.svg", "avatar.metadata.svg"],
});

ninja.comment("Diagnostics: ninja -t graph | ninja -t commands | ninja -d explain <target>");

ninja.default("full");
writeManifestAtomically(buildNinjaPath, ninja.output);
// eslint-disable-next-line no-console
console.log(`Wrote ${buildNinjaPath}`);
