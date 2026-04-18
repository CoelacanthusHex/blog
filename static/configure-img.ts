// configure-img.ts — writes .ninja_build/avatar-meta.xmp and generates build.ninja.
// Run with: bun run static/configure-img.ts
// Then build with: ninja -C static
//
// Pipeline per variant × size:
//   avatar.svg
//     → rsvg-convert → canonical-16384.png  (tmp, one per variant)
//     → magick EWA   → <prefix>-NxN.png     (output, may use intermediate)
//     → optipng      → PNG optimised in-place
//     → exiv2        → PNG with Exif+XMP in-place
//     → cjxl         → <prefix>-NxN.jxl
//     → cwebp        → <prefix>-NxN.webp    → exiv2 in-place → WebP with Exif+XMP
//     → avifenc      → <prefix>-NxN.avif    → exiftool in-place → AVIF with Exif+XMP

// FIXME: @ninjutsu-build/core 0.9.0 does not ship type definitions (dist/core.d.ts).
// A hand-crafted .d.ts has been added manually to node_modules/@ninjutsu-build/core/dist/core.d.ts
// and "types" added to its package.json as a workaround.
// Track: https://github.com/elliotgoodrich/ninjutsu-build/issues/112
// Remove the workaround once a fixed version is released.
import { NinjaBuilder, needs, orderOnlyDeps, implicitDeps } from "@ninjutsu-build/core";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { XmlParser, XmlElement, XmlText } from "xml-trueformat";
import type { XmlChildNode } from "xml-trueformat";
import { quote } from "shell-quote";

const DIR      = dirname(fileURLToPath(import.meta.url));
const filePath = (name: string): string => resolve(DIR, name);
const buildDir = filePath(".ninja_build");

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

interface Meta {
  readonly title: string;
  readonly description: string;
  readonly creator: string;
  readonly copyright: string;
  readonly year: string;
  readonly documentID: string;
}

function textContent(el: XmlElement | undefined): string {
  if (el === undefined) return "";
  return el.children.map((c: XmlChildNode) => {
    if (c instanceof XmlText) return c.text;
    if (c instanceof XmlElement) return textContent(c);
    return "";
  }).join("");
}

// Find first child element matching local name (ignoring namespace prefix).
// e.g. localName("foaf:Person") === "Person", so prefix changes don't break lookup.
// If skipEmpty is true, skips elements with no text content.
function getByLocal(el: XmlElement | undefined, localName: string, skipEmpty = false): XmlElement | undefined {
  if (el === undefined) return undefined;
  return el.children.find(
    (c): c is XmlElement =>
      c instanceof XmlElement &&
      (c.tagName === localName || c.tagName.endsWith(`:${localName}`)) &&
      (!skipEmpty || textContent(c).trim().length > 0)
  );
}

function extractMeta(svgPath: string): Meta {
  const content = readFileSync(svgPath, "utf8");
  const doc  = XmlParser.parse(content);
  const svg  = doc.getRootElement();

  const title       = textContent(svg.getFirstElementByName("title")).trim();
  const description = textContent(svg.getFirstElementByName("desc")).trim();

  const metadata = svg.getFirstElementByName("metadata");
  const rdfRDF   = getByLocal(metadata, "RDF");
  // cc:Work (current + Inkscape 1.x) or rdf:Description (older Inkscape)
  const ccWork   = getByLocal(rdfRDF, "Work")
                ?? getByLocal(rdfRDF, "Description");

  const copyright = textContent(
    getByLocal(ccWork, "rights", true)
  ).trim();
  // dcterms:created (current) or dc:date (Inkscape)
  const year = textContent(
    getByLocal(ccWork, "created")
    ?? getByLocal(ccWork, "date")
  ).trim();

  // dcterms:creator text (current) or dc:creator/cc:Agent/dc:title (Inkscape)
  const creator = (
    textContent(getByLocal(ccWork, "creator", true)).trim()
    || textContent(
         getByLocal(getByLocal(getByLocal(ccWork, "creator"), "Agent"), "title")
       ).trim()
  );

  const aboutAttr  = ccWork?.getAttributeValue("rdf:about") ?? ccWork?.getAttributeValue("about");
  const documentID = aboutAttr ?? `xmp.did:avatar-svg-${Date.now().toString()}`;

  return { title, description, creator, copyright, year, documentID };
}

// ---------------------------------------------------------------------------
// XMP builder
// ---------------------------------------------------------------------------

function buildXmp(meta: Meta): string {
  const now = new Date().toISOString().slice(0, 10);
  const xmpDate = meta.year.length === 4 ? `${meta.year}-01-01` : meta.year;
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
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${meta.title}</rdf:li></rdf:Alt></dc:title>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${meta.description}</rdf:li></rdf:Alt></dc:description>
      <dc:creator><rdf:Seq><rdf:li>${meta.creator}</rdf:li></rdf:Seq></dc:creator>
      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${meta.copyright}</rdf:li></rdf:Alt></dc:rights>
      <dc:type><rdf:Bag><rdf:li rdf:resource="http://purl.org/dc/dcmitype/StillImage"/></rdf:Bag></dc:type>
      <dcterms:license rdf:resource="http://rightsstatements.org/vocab/InC/1.0/"/>
      <xmpRights:Marked>True</xmpRights:Marked>
      <xmpRights:Owner><rdf:Bag><rdf:li>${meta.creator}</rdf:li></rdf:Bag></xmpRights:Owner>
      <xmpRights:UsageTerms><rdf:Alt><rdf:li xml:lang="x-default">All rights reserved.</rdf:li></rdf:Alt></xmpRights:UsageTerms>
      <xmpRights:WebStatement>http://rightsstatements.org/vocab/InC/1.0/</xmpRights:WebStatement>
      <xmp:CreatorTool>rsvg-convert</xmp:CreatorTool>
      <xmp:CreateDate>${xmpDate}</xmp:CreateDate>
      <xmp:MetadataDate>${now}</xmp:MetadataDate>
      <photoshop:DateCreated>${xmpDate}</photoshop:DateCreated>
      <photoshop:Credit>${meta.creator}</photoshop:Credit>
      <xmpMM:DocumentID>${meta.documentID}</xmpMM:DocumentID>
      <xmpMM:OriginalDocumentID>${meta.documentID}</xmpMM:OriginalDocumentID>
      <xmpMM:InstanceID>xmp.iid:${crypto.randomUUID()}</xmpMM:InstanceID>
      <xmpMM:DerivedFrom rdf:parseType="Resource">
        <stRef:filePath>avatar.svg</stRef:filePath>
        <stRef:documentID>${meta.documentID}</stRef:documentID>
      </xmpMM:DerivedFrom>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// ---------------------------------------------------------------------------
// Exif / exiftool arg builders
// ---------------------------------------------------------------------------

function makeExifArgs(m: {
  creator: string; description: string; copyright: string; year: string;
}): string {
  const exifDate = m.year.length === 4 ? `${m.year}:01:01 00:00:00` : m.year;
  const fields: [string, string][] = [
    ["Exif.Image.Artist",            m.creator],
    ["Exif.Image.ImageDescription",  m.description],
    ["Exif.Image.Copyright",         m.copyright],
    ["Exif.Image.Software",          "rsvg-convert"],
    ["Exif.Image.DateTime",          exifDate],
    ["Exif.Photo.DateTimeOriginal",  exifDate],
    ["Exif.Photo.DateTimeDigitized", exifDate],
  ];
  const strArgs = fields
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `-M ${quote([`set ${k} Ascii ${v}`])}`)
    .join(" ");
  return [
    strArgs,
    `-M ${quote(["set Exif.Image.XResolution Rational 96/1"])}`,
    `-M ${quote(["set Exif.Image.YResolution Rational 96/1"])}`,
    `-M ${quote(["set Exif.Image.ResolutionUnit Short 2"])}`,
    `-M ${quote(["set Exif.Image.Orientation Short 1"])}`,
    `-M ${quote(["set Exif.Photo.ColorSpace Short 1"])}`,
  ].filter(Boolean).join(" ");
}

function makeExiftoolArgs(m: {
  creator: string; description: string; copyright: string;
}): string {
  return [
    m.creator     ? `-Artist=${quote([m.creator])}`               : "",
    m.description ? `-ImageDescription=${quote([m.description])}` : "",
    m.copyright   ? `-Copyright=${quote([m.copyright])}`          : "",
    `-Software=rsvg-convert`,
    `-XResolution=96 -YResolution=96 -ResolutionUnit=inch`,
    `-Orientation=1`,
  ].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Variant / size config
// ---------------------------------------------------------------------------

interface Variant {
  readonly prefix: string;
  readonly svg: string;
  readonly bg: readonly string[];
}

const VARIANTS: readonly Variant[] = [
  { prefix: "avatar",                      svg: "avatar.svg",              bg: [] },
  { prefix: "avatar-white-bg",             svg: "avatar.svg",              bg: ["--background-color", "white"] },
  { prefix: "avatar-round",               svg: "avatar-round.svg",        bg: [] },
  { prefix: "avatar-round-white-bg",      svg: "avatar-round.svg",        bg: ["--background-color", "white"] },
  { prefix: "avatar-round-smaller",       svg: "avatar-round-smaller.svg", bg: [] },
  { prefix: "avatar-round-smaller-white-bg", svg: "avatar-round-smaller.svg", bg: ["--background-color", "white"] },
] as const;

const SIZES: readonly number[] = [80, 256, 400, 512, 1024, 2048, 4096, 8192] as const;

const CANONICAL_SIZE = 16384;
const MAX_STEP_RATIO = 32;

function intermediateFor(size: number, sizes: readonly number[]): number | null {
  if (CANONICAL_SIZE / size <= MAX_STEP_RATIO) return null;
  const candidate = [...sizes]
    .filter(s => s >= size * 8 && s <= size * MAX_STEP_RATIO)
    .sort((a, b) => b - a)[0];
  return candidate ?? null;
}

// ---------------------------------------------------------------------------
// Step 1: write XMP sidecar into builddir
// ---------------------------------------------------------------------------

mkdirSync(buildDir, { recursive: true });
const meta    = extractMeta(filePath("avatar.svg"));
const xmpFile = `${buildDir}/avatar-meta.xmp`;
writeFileSync(xmpFile, buildXmp(meta));
// eslint-disable-next-line no-console
console.log(`Wrote ${xmpFile}`);

const exifArgs     = makeExifArgs(meta);
const exiftoolArgs = makeExiftoolArgs(meta);

// ---------------------------------------------------------------------------
// Step 2: generate build.ninja
// ---------------------------------------------------------------------------

const ninja = new NinjaBuilder({
  ninja_required_version: "1.11",
  builddir: buildDir,
});

ninja.comment("=== Pools ===");
// rsvgPool: rsvg-convert at 16384px uses ~1GB RAM; run only one at a time
// and share the pool with magick to prevent simultaneous large-image jobs.
const rsvgPool  = ninja.pool("rsvg",   { depth: 1 });
// magickPool: shares depth with rsvg via separate pool but kept low to avoid OOM
const magickPool = ninja.pool("magick", { depth: 2 });
// heavyPool: cjxl/cwebp/avifenc are CPU-heavy but lower memory; allow 2 concurrent
const heavyPool  = ninja.pool("heavy",  { depth: 2 });

ninja.comment("=== Rules ===");

const rsvgConvert = ninja.rule("rsvg_convert", {
  command:     "rsvg-convert $in $bg -w $size -h $size -a -o $out",
  description: "rsvg-convert $in → $out ($size×$size)",
  out:  needs<string>(),
  in:   needs<string>(),
  bg:   "",
  size: needs<string>(),
  pool: rsvgPool,
});

const magickEwa = ninja.rule("magick_ewa", {
  command:     "magick $in -colorspace RGB -filter MagicKernelSharp2021 -distort Resize $size +repage -colorspace sRGB -depth 8 -define png:compression-level=9 -define png:compression-strategy=1 $out",
  description: "magick MKS2021/EWA $in → $out ($size)",
  out:  needs<string>(),
  in:   needs<string>(),
  size: needs<string>(),
  pool: magickPool,
});

// exiv2: embed Exif + XMP sidecar in one shot, writing a stamp file as out.
// Ninja forbids two rules with the same out, so in-place ops use a stamp.
// exiv2 -i x looks for <basename>.xmp in $builddir, so we cp the shared XMP
// sidecar to $builddir/<base>.xmp before invoking it.
// $in is the file to modify (tracked as real input so ninja rebuilds on change).
const exiv2Meta = ninja.rule("exiv2_meta", {
  command:     "cp $xmp $builddir/$base.xmp && exiv2 $args $in && exiv2 -i x -S .xmp -l $builddir in $in && touch $out",
  description: "exiv2 Exif+XMP → $in",
  out:  needs<string>(),
  in:   needs<string>(),
  base: needs<string>(),
  xmp:  needs<string>(),
  args: needs<string>(),
});

// optipng: lossless PNG optimisation in-place, stamp records completion.
// Runs after exiv2 (Exif/XMP preserved by -preserve) and before encoders.
const optipng = ninja.rule("optipng", {
  command:     "optipng -o7 -zm1-9 -i 0 -preserve $in && touch $out",
  description: "optipng → $in",
  out:  needs<string>(),
  in:   needs<string>(),
});

const cjxl = ninja.rule("cjxl", {
  command:     "cjxl --allow_expert_options --distance=0.0 --effort=10 --brotli_effort=11 --container=1 -x xmp=$xmp $in $out",
  description: "cjxl $in → $out",
  out:  needs<string>(),
  in:   needs<string>(),
  xmp:  needs<string>(),
  pool: heavyPool,
});

const cwebp = ninja.rule("cwebp", {
  command:     "cwebp -lossless -m 6 -mt -alpha_filter best -af -exact $in -o $out",
  description: "cwebp $in → $out",
  out:  needs<string>(),
  in:   needs<string>(),
  pool: heavyPool,
});

const avifencMeta = ninja.rule("avifenc_meta", {
  command:     "avifenc --speed 0 --autotiling -d 8 --xmp $xmp $in $out && exiftool -tagsfromfile $xmp $exifargs -overwrite_original $out",
  description: "avifenc+meta $in → $out",
  out:      needs<string>(),
  in:       needs<string>(),
  xmp:      needs<string>(),
  exifargs: needs<string>(),
  pool:     heavyPool,
});

ninja.comment("=== Build edges ===");

const allOutputs: string[] = [];

for (const v of VARIANTS) {
  ninja.comment(`--- ${v.prefix} ---`);

  const canonicalPng = `$builddir/${v.prefix}-canonical.png`;
  rsvgConvert({
    out:  canonicalPng,
    in:   filePath(v.svg),
    bg:   v.bg.join(" "),
    size: CANONICAL_SIZE.toString(),
  });

  const pngMap = new Map<number, string>();
  const sortedSizes       = [...SIZES].sort((a, b) => b - a);
  const canonicalSizes    = sortedSizes.filter(s => intermediateFor(s, SIZES) === null);
  const intermediateSizes = sortedSizes.filter(s => intermediateFor(s, SIZES) !== null);

  for (const size of canonicalSizes) {
    const outPng = filePath(`${v.prefix}-${size.toString()}x${size.toString()}.png`);
    magickEwa({ out: outPng, in: canonicalPng, size: `${size.toString()}x${size.toString()}` });
    pngMap.set(size, outPng);
  }

  for (const size of intermediateSizes) {
    const src = intermediateFor(size, SIZES);
    if (src === null) throw new Error(`No intermediate found for size ${String(size)}`);
    const srcPng = pngMap.get(src);
    if (srcPng === undefined) throw new Error(`Intermediate ${String(src)} not rasterized yet for size ${String(size)}`);
    const outPng = filePath(`${v.prefix}-${size.toString()}x${size.toString()}.png`);
    magickEwa({ out: outPng, in: srcPng, size: `${size.toString()}x${size.toString()}` });
    pngMap.set(size, outPng);
  }

  for (const size of SIZES) {
    const base      = `${v.prefix}-${size.toString()}x${size.toString()}`;
    const png       = filePath(`${base}.png`);
    const jxl       = filePath(`${base}.jxl`);
    const webp      = filePath(`${base}.webp`);
    const avif      = filePath(`${base}.avif`);
    const pngStamp  = `$builddir/${base}.png.stamp`;
    const webpStamp = `$builddir/${base}.webp.stamp`;
    const pngOptStamp = `$builddir/${base}.png.opt.stamp`;

    const pngStampOut = exiv2Meta({
      out:  pngStamp,
      in:   png,
      base: base,
      xmp:  xmpFile,
      args: exifArgs,
      [implicitDeps]: xmpFile,
      ...(pngMap.get(size) !== png ? { [orderOnlyDeps]: pngMap.get(size) } : {}),
    });
    const pngOptOut = optipng({
      out:  pngOptStamp,
      in:   png,
      [orderOnlyDeps]: pngStampOut,
    });

    const jxlOut = cjxl({
      out: jxl,
      in:  png,
      xmp: xmpFile,
      [implicitDeps]: xmpFile,
      [orderOnlyDeps]: pngOptOut,
    });

    const webpRaw = cwebp({
      out: webp,
      in:  png,
      [orderOnlyDeps]: pngOptOut,
    });
    const webpStampOut = exiv2Meta({
      out:  webpStamp,
      in:   webp,
      base: base,
      xmp:  xmpFile,
      args: exifArgs,
      [implicitDeps]: xmpFile,
    });

    // const avifOut = avifencMeta({
    //   out:      avif,
    //   in:       png,
    //   xmp:      xmpFile,
    //   exifargs: exiftoolArgs,
    //   [implicitDeps]: xmpFile,
    //   [orderOnlyDeps]: pngOptOut,
    // });

    allOutputs.push(jxlOut, webpStampOut, pngOptOut);
  }
}

ninja.default(...allOutputs);
writeFileSync(filePath("build.ninja"), ninja.output);
// eslint-disable-next-line no-console
console.log(`Wrote ${filePath("build.ninja")}`);
