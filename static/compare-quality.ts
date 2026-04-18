// SPDX-License-Identifier: MPL-2.0
// compare-quality.ts — print PSNR+SSIM+XPSNR+VMAF+SSIMU2+size table from .quality/.ssimu2 files,
// and optionally write a gnuplot script for a bpp-vs-SSIMU2 Pareto-front scatter plot (PDF output).
// Each .quality file contains ffmpeg stderr output + a final line with file size (bytes).
// Usage: bun run compare-quality.ts [--script <out.gnuplot>] <file1.quality> [file2.quality ...]
// Filenames encode variant/size/format: .ninja_build/VARIANT-NxN.FMT.quality

import { readFile, writeFile } from "node:fs/promises";
import { createTable } from "@visulima/tabular";
import { type Nullable, isNotNull } from "option-t/nullable";
import { unwrapOrForNullable } from "option-t/nullable/unwrap_or";
import { unwrapOrForUndefinable } from "option-t/undefinable/unwrap_or";

interface Row {
  variant: string;
  size: number;
  fmt: string;
  fileSize: number;
  psnr:   Nullable<string>;
  ssim:   Nullable<string>;
  xpsnr:  Nullable<string>;
  vmaf:   Nullable<string>;
  ssimu2: Nullable<string>;
}

async function parseQualityFile(path: string): Promise<Row | null> {
  // path: .ninja_build/VARIANT-NxN.FMT.quality or .ninja_build/VARIANT-NxN.FMT.ssimu2
  const isSsimu2 = path.endsWith(".ssimu2");
  const name = path.replace(/.*\//, "").replace(/\.(quality|ssimu2)$/, "");
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const fmt = name.slice(dotIdx + 1);
  const base = name.slice(0, dotIdx);
  const sizeMatch = /-(\d+)x\d+$/.exec(base);
  if (sizeMatch?.[1] === undefined) return null;
  const size = Number(sizeMatch[1]);
  const variant = base.slice(0, base.lastIndexOf(`-${sizeMatch[1]}x`));

  const content = await readFile(path, "utf8");
  const lines = content.split("\n");

  // Last non-empty line is file size from `wc -c`
  const lastLine = lines.filter((l: string) => l.trim()).at(-1) ?? "";
  const fileSize = Number(lastLine.trim());

  if (isSsimu2) {
    // ssimulacra2 outputs a float score (may be negative) on the first non-empty line,
    // followed by the file size integer as the last line. Match only lines with a decimal point.
    const ssimu2 = lines.find((l: string) => /^-?[0-9]+\.[0-9]+$/.test(l.trim()))?.trim() ?? null;
    return { variant, size, fmt, fileSize, psnr: null, ssim: null, xpsnr: null, vmaf: null, ssimu2 };
  }

  // ffmpeg outputs "inf" for PSNR/XPSNR when images are identical (lossless formats).
  const psnr  = /\[Parsed_psnr[^\]]*\].*?average:(inf|[0-9.]+)/s.exec(content)?.[1]      ?? null;
  const ssim  = /\[Parsed_ssim[^\]]*\].*?All:([0-9.]+)/s.exec(content)?.[1]              ?? null;
  const xpsnr = /\[Parsed_xpsnr[^\]]*\].*?minimum:\s*(inf|[0-9.]+)/s.exec(content)?.[1]  ?? null;
  const vmaf  = /\[Parsed_libvmaf[^\]]*\].*?VMAF score:\s*([0-9.]+)/s.exec(content)?.[1] ?? null;

  return { variant, size, fmt, fileSize, psnr, ssim, xpsnr, vmaf, ssimu2: null };
}

// Merge .quality and .ssimu2 rows for the same (variant, size, fmt) into one row.
// The .ssimu2 row carries the ssimu2 score; the .quality row carries everything else.
function mergeRows(rows: Row[]): Row[] {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const key = `${row.variant}|${String(row.size)}|${row.fmt}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
    } else {
      map.set(key, {
        ...existing,
        ssimu2:  isNotNull(existing.ssimu2)  ? existing.ssimu2  : row.ssimu2,
        psnr:    isNotNull(existing.psnr)    ? existing.psnr    : row.psnr,
        ssim:    isNotNull(existing.ssim)    ? existing.ssim    : row.ssim,
        xpsnr:   isNotNull(existing.xpsnr)   ? existing.xpsnr   : row.xpsnr,
        vmaf:    isNotNull(existing.vmaf)    ? existing.vmaf    : row.vmaf,
        // fileSize from .quality row is authoritative (ssimu2 row also has it, but same value)
        fileSize: existing.fileSize > 0 ? existing.fileSize : row.fileSize,
      });
    }
  }
  return [...map.values()];
}

// Format display names and gnuplot line/point styles.
// lc = line color (gnuplot named colors), pt = point type (gnuplot pt index)
const FMT_STYLE: Record<string, { title: string; lc: string; pt: number }> = {
  png:  { title: "PNG",  lc: "#4e79a7", pt: 7  },  // circle
  jpg:  { title: "JPEG", lc: "#f28e2b", pt: 9  },  // triangle up
  jxl:  { title: "JXL",  lc: "#59a14f", pt: 11 },  // diamond
  webp: { title: "WebP", lc: "#e15759", pt: 13 },  // pentagon
  avif: { title: "AVIF", lc: "#b07aa1", pt: 5  },  // square
  heic: { title: "HEIC", lc: "#76b7b2", pt: 3  },  // asterisk
  jp2:  { title: "JP2",  lc: "#edc948", pt: 2  },  // cross
};

async function writeGnuplotScript(scriptOut: string, rows: Row[]): Promise<void> {
  // Only rows with a numeric ssimu2 score and valid fileSize can be plotted.
  // Exclude lossless encodes (PSNR=inf or SSIMU2≥100) — they cluster at the top with
  // varying bpp but identical quality, adding noise rather than useful information.
  const plotRows = rows.filter(r =>
    isNotNull(r.ssimu2) &&
    r.fileSize > 0 &&
    r.size > 0 &&
    r.psnr !== "inf" &&
    Number(r.ssimu2) < 100
  );
  if (plotRows.length === 0) {
    console.error("compare-quality: no SSIMU2 data available, skipping plot script");
    return;
  }

  const fmts = ["png", "jpg", "jxl", "webp", "avif", "heic", "jp2"].filter(f => plotRows.some(r => r.fmt === f));

  // Build per-format inline data blocks, sorted by bpp so linespoints connects in order.
  // Columns: bpp  ssimu2
  const dataBlocks: string[] = [];
  // Emit individual set label commands with alternating y-offsets to reduce overlap.
  const labelCmds: string[] = [];
  let labelIdx = 1;
  for (const fmt of fmts) {
    const s = FMT_STYLE[fmt] ?? { title: fmt, lc: "#888888", pt: 7 };
    const fmtRows = plotRows
      .filter(r => r.fmt === fmt)
      .map(r => ({ ...r, bpp: (r.fileSize * 8) / (r.size * r.size) }))
      .sort((a, b) => a.bpp - b.bpp);
    // r.ssimu2 is non-null here (filtered above)
    const lines = fmtRows.map(r => `${r.bpp.toFixed(6)} ${unwrapOrForNullable(r.ssimu2, "")}`);
    dataBlocks.push(`$data_${fmt} <<EOD\n${lines.join("\n")}\nEOD`);
    fmtRows.forEach((r, i) => {
      const yoff = (i % 2 === 0) ? 1.2 : -1.5;
      const label = `${r.variant}-${String(r.size)}x${String(r.size)}`;
      labelCmds.push(
        `set label ${String(labelIdx)} "${label}" at ${r.bpp.toFixed(6)},${unwrapOrForNullable(r.ssimu2, "")} offset char 0.5,${yoff.toFixed(1)} font "Sans,9" tc rgb "${s.lc}"`
      );
      labelIdx++;
    });
  }

  const plotCmds: string[] = [];
  for (const fmt of fmts) {
    const s = FMT_STYLE[fmt] ?? { title: fmt, lc: "#888888", pt: 7 };
    plotCmds.push(
      `$data_${fmt} using 1:2 with linespoints pt ${String(s.pt)} ps 1.5 lw 2 lc rgb "${s.lc}" title "${s.title}"`,
    );
  }

  const script = `set terminal pdfcairo size 12,8 enhanced font "Sans,11"

set title "Quality vs file size — bpp vs SSIMU2 (higher-left is better)"
set xlabel "Bits per pixel (lower is better)"
set ylabel "SSIMULACRA2 score (higher is better)"
set grid
set key top right
set border 3
set tics nomirror

${labelCmds.join("\n")}

${dataBlocks.join("\n")}

plot ${plotCmds.join(", \\\n     ")}
`;

  await writeFile(scriptOut, script, "utf8");
}

function displayMetric(v: Nullable<string>): string {
  return unwrapOrForNullable(v, "N/A");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  // Parse --script <scriptfile> flag; gnuplot receives the output path via -e on the command line
  let scriptOut: string | undefined;
  const scriptIdx = argv.indexOf("--script");
  if (scriptIdx !== -1) {
    scriptOut = argv[scriptIdx + 1];
    argv.splice(scriptIdx, 2);
  }

  const args = argv.filter((a: string) => a.endsWith(".quality") || a.endsWith(".ssimu2"));
  if (args.length === 0) {
    console.error("Usage: bun run compare-quality.ts [--script <out.gnuplot>] <file.quality>...");
    process.exit(1);
  }

  const rawRows: Row[] = [];
  for (const arg of args) {
    const row = await parseQualityFile(arg);
    if (isNotNull(row)) rawRows.push(row);
  }

  const rows = mergeRows(rawRows);

  const fmtOrder = ["png", "jpg", "jxl", "webp", "avif", "heic", "jp2"];
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.variant}-${String(row.size)}x${String(row.size)}`;
    const g = unwrapOrForUndefinable(groups.get(key), []);
    g.push(row);
    groups.set(key, g);
  }

  const sortedKeys = [...groups.keys()].sort();

  const table = createTable({
    style: { paddingLeft: 1, paddingRight: 1 },
  });
  table.setHeaders([
    "variant+size",
    "fmt",
    { content: "bytes",  hAlign: "right" },
    { content: "PSNR",   hAlign: "right" },
    { content: "SSIM",   hAlign: "right" },
    { content: "XPSNR",  hAlign: "right" },
    { content: "VMAF",   hAlign: "right" },
    { content: "SSIMU2", hAlign: "right" },
  ]);

  for (const key of sortedKeys) {
    const group = (unwrapOrForUndefinable(groups.get(key), [])).sort(
      (a: Row, b: Row) => fmtOrder.indexOf(a.fmt) - fmtOrder.indexOf(b.fmt)
    );
    for (const row of group) {
      table.addRow([
        key,
        row.fmt,
        { content: String(row.fileSize),        hAlign: "right" },
        { content: displayMetric(row.psnr),   hAlign: "right" },
        { content: displayMetric(row.ssim),   hAlign: "right" },
        { content: displayMetric(row.xpsnr),  hAlign: "right" },
        { content: displayMetric(row.vmaf),   hAlign: "right" },
        { content: displayMetric(row.ssimu2), hAlign: "right" },
      ]);
    }
  }

  // Only print the table when running as the report step, not the script-generation step.
  if (scriptOut === undefined) {
    console.log("Quality comparison vs raw.png reference");
    console.log(table.toString());
  }

  if (scriptOut !== undefined) {
    await writeGnuplotScript(scriptOut, rows);
  }
}

await main();
