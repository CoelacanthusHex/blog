// SPDX-License-Identifier: MPL-2.0
// ninja-img-rules.ts — Ninja pool and rule definitions for the avatar image pipeline.
// Called once from configure-img.ts after the NinjaBuilder is created.

import { type NinjaBuilder, needs } from "@ninjutsu-build/core";
import { cpus } from "node:os";

export interface PoolDepths {
  readonly rsvg: number;
  readonly magick: number;
  readonly heavy: number;
  readonly exiftool: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function computePoolDepths(): PoolDepths {
  const cpu = cpus().length || 4;
  const rsvg = 1;
  const magick = Math.max(1, Math.min(2, Math.floor(cpu / 8) || 1));
  const heavy = Math.max(1, Math.min(4, Math.floor(cpu / 4) || 1));
  // exiftool: I/O-bound Perl process, ~50-100ms startup. Allow more concurrency than heavy
  // but cap to avoid memory pressure from many Perl interpreters.
  const exiftool = Math.max(1, Math.min(8, Math.floor(cpu / 2) || 4));
  return {
    rsvg: envInt("IMG_POOL_RSVG", rsvg),
    magick: envInt("IMG_POOL_MAGICK", magick),
    heavy: envInt("IMG_POOL_HEAVY", heavy),
    exiftool: envInt("IMG_POOL_EXIFTOOL", exiftool),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function defineImgRules(ninja: NinjaBuilder, pools: PoolDepths) {
  ninja.comment("=== Pools ===");
  const rsvgPool     = ninja.pool("rsvg",     { depth: pools.rsvg });
  const magickPool   = ninja.pool("magick",   { depth: pools.magick });
  const heavyPool    = ninja.pool("heavy",    { depth: pools.heavy });
  const exiftoolPool = ninja.pool("exiftool", { depth: pools.exiftool });

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

  const pngOptimize = ninja.rule("png_optimize", {
    command: "cp --reflink=auto $in $out$cicp_cmd && optipng -o7 -zm1-9 -i 0 -preserve $out",
    description: "optimize PNG $in -> $out",
    out: needs<string>(),
    in: needs<string>(),
    cicp_cmd: "",
    restat: 1,
    pool: heavyPool,
  });

  /** Unified metadata embedding rule using exiftool only.
   *  -@ argsfile: Exif IFD + PNG iTXt fields (PNG:* tags ignored for non-PNG formats)
   *  -tagsfromfile xmp -XMP:all: embed full XMP packet from shared sidecar
   *  -o $out $in: non-in-place output; rm -f first because exiftool refuses to overwrite */
  const embedMetadata = ninja.rule("embed_metadata", {
    command: "rm -f $out && exiftool -@ $argsfile -tagsfromfile $xmp -XMP:all -o $out $in",
    description: "embed metadata $in -> $out",
    out: needs<string>(),
    in: needs<string>(),
    argsfile: needs<string>(),
    xmp: needs<string>(),
    restat: 1,
    pool: exiftoolPool,
  });

  const reflinkCopy = ninja.rule("reflink_copy", {
    command: "cp --reflink=auto $in $out",
    description: "reflink copy $in -> $out",
    out: needs<string>(),
    in: needs<string>(),
    restat: 1,
  });

  const cjxl = ninja.rule("cjxl", {
    command: "cjxl --num_threads=$threads --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 --container=1 $in $out",
    description: "cjxl $in -> $out",
    out: needs<string>(),
    in: needs<string>(),
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

  const cjpegli = ninja.rule("cjpegli", {
    command: "cjpegli --distance=1.0 --chroma_subsampling=444 --progressive_level=1 $in $out",
    description: "cjpegli $in -> $out",
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
    description: "generate SVG image-only variants",
    out: needs<readonly string[]>(),
    in: needs<readonly string[]>(),
    generator: 1,
    restat: 1,
  });

  const svgMerge = ninja.rule("svg_merge", {
    command: "bun run svg-merge.ts",
    description: "merge SVG image + metadata variants",
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

  /** measure_quality: runs ffmpeg PSNR+SSIM+XPSNR+VMAF for one file vs raw.png reference.
   *  Output file contains ffmpeg stderr + file size line for parsing by compare-quality.ts. */
  const measureQuality = ninja.rule("measure_quality", {
    command: "ffmpeg -i $ref -i $in -lavfi \"ssim;[0:v][1:v]psnr;[0:v][1:v]xpsnr;[0:v][1:v]libvmaf\" -f null - > $out 2>&1; wc -c < $in >> $out",
    description: "measure quality $in",
    out: needs<string>(),
    in: needs<string>(),
    ref: needs<string>(),
    restat: 1,
  });

  /** measure_ssimu2: runs ssimulacra2 (by explicit path $ssimu2, not PATH) for one file vs raw.png.
   *  Output file contains the ssimulacra2 score + file size, parsed by compare-quality.ts.
   *  Only emitted when ./ssimulacra2 binary exists (built via build-ssimulacra2.sh). */
  const measureSsimu2 = ninja.rule("measure_ssimu2", {
    command: "$ssimu2 $ref $in > $out 2>&1; wc -c < $in >> $out",
    description: "measure ssimulacra2 $in",
    out: needs<string>(),
    in: needs<string>(),
    ref: needs<string>(),
    ssimu2: needs<string>(),
    restat: 1,
  });

  const reportQuality = ninja.rule("report_quality", {
    command: "bun run compare-quality.ts $in 2>&1 | tee $out",
    description: "report quality comparison",
    out: needs<string>(),
    in: needs<readonly string[]>(),
    pool: "console",
  });

  /** gen_quality_script: writes a gnuplot script from .quality/.ssimu2 data.
   *  Only emitted when ./ssimulacra2 is available, since SSIMU2 is the Y axis. */
  const genQualityScript = ninja.rule("gen_quality_script", {
    command: "bun run compare-quality.ts --script $out $in",
    description: "generate quality plot script",
    out: needs<string>(),
    in: needs<readonly string[]>(),
    restat: 1,
  });

  const gnuplotRule = ninja.rule("gnuplot", {
    command: "gnuplot -e \"set output '$out'\" $in",
    description: "gnuplot $out",
    out: needs<string>(),
    in: needs<string>(),
  });

  // Decode extra formats to PNG for ssimulacra2 (which only reads PNG/JPEG).
  // Also used for WebP since ssimulacra2 doesn't support WebP input directly.
  const decodeToPng = ninja.rule("decode_to_png", {
    command: "ffmpeg -y -i $in $out",
    description: "decode $in -> $out",
    out: needs<string>(),
    in: needs<string>(),
    restat: 1,
    pool: heavyPool,
  });

  // Extra lossy formats for quality comparison only — not part of the default build targets.
  const avifenc = ninja.rule("avifenc", {
    command: "avifenc -q 60 -s 6 $in $out",
    description: "avifenc $in -> $out",
    out: needs<string>(),
    in: needs<string>(),
    restat: 1,
    pool: heavyPool,
  });

  const heifEnc = ninja.rule("heif_enc", {
    command: "heif-enc -q 60 -o $out $in",
    description: "heif-enc $in -> $out",
    out: needs<string>(),
    in: needs<string>(),
    restat: 1,
    pool: heavyPool,
  });

  const opjCompress = ninja.rule("opj_compress", {
    command: "opj_compress -i $in -o $out -r 10",
    description: "opj_compress $in -> $out",
    out: needs<string>(),
    in: needs<string>(),
    restat: 1,
    pool: heavyPool,
  });

  return {
    genXmp, rsvgConvert, magickEwa, pngOptimize, embedMetadata, reflinkCopy,
    cjxl, cwebp, cjpegli, magickIco, symlinkRule,
    svgVariants, svgMerge, reconfigure,
    checkMissingDepsRule, checkCommandsRule,
    measureQuality, measureSsimu2, reportQuality, genQualityScript, gnuplotRule,
    decodeToPng, avifenc, heifEnc, opjCompress,
    heavyPool,
  };
}
