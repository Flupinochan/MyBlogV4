// Compiles a .d2 file to SVG (via the D2 WASM compiler) and rasterizes it to PNG.
// Usage: node render.mjs <input.d2> <output.png>
//
// D2's `icon:` field embeds remote image URLs (e.g. the AWS icon set hosted at
// icons.terrastruct.com) as <image href="https://..."> in the SVG output. sharp's SVG
// rasterizer (librsvg) does not fetch remote URLs, so those icons would render blank.
// This script fetches each referenced icon once, caches it on disk, and inlines it as a
// base64 data URI before rasterizing.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { D2 } from "@terrastruct/d2";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(__dirname, ".icon-cache");

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: node render.mjs <input.d2> <output.png>");
  process.exit(1);
}

async function fetchAsDataUri(url) {
  await mkdir(cacheDir, { recursive: true });
  const cacheKey = crypto.createHash("sha256").update(url).digest("hex");
  const cacheFile = path.join(cacheDir, cacheKey);
  const metaFile = `${cacheFile}.meta`;

  let buf;
  let contentType = await readFile(metaFile, "utf-8").catch(() => null);
  if (contentType) {
    buf = await readFile(cacheFile).catch(() => null);
  }

  if (!buf) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      contentType = res.headers.get("content-type") ?? "image/svg+xml";
      buf = Buffer.from(await res.arrayBuffer());
      await writeFile(cacheFile, buf);
      await writeFile(metaFile, contentType);
    } catch (err) {
      console.error(`Warning: failed to fetch icon ${url}: ${err.message ?? err}`);
      return null;
    }
  }

  return `data:${contentType};base64,${buf.toString("base64")}`;
}

function unescapeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function inlineRemoteImages(svg) {
  // hrefs inside SVG attributes are XML-escaped (e.g. "&" -> "&amp;"), but the actual
  // URL to fetch needs the unescaped form.
  const rawHrefs = [...new Set([...svg.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]))];
  let result = svg;
  for (const rawHref of rawHrefs) {
    const url = unescapeXmlEntities(rawHref);
    const dataUri = await fetchAsDataUri(url);
    if (dataUri) {
      result = result.split(`href="${rawHref}"`).join(`href="${dataUri}"`);
    }
  }
  return result;
}

const input = await readFile(inputPath, "utf-8");
const d2 = new D2();

let compiled;
try {
  compiled = await d2.compile(input, { layout: "dagre", pad: 40 });
} catch (err) {
  console.error("D2 compile error:");
  console.error(err.message ?? err);
  process.exit(1);
}

let svg = await d2.render(compiled.diagram, compiled.renderOptions);
svg = await inlineRemoteImages(svg);

const svgPath = outputPath.replace(/\.png$/, ".svg");
await writeFile(svgPath, svg, "utf-8");

await sharp(Buffer.from(svg), { density: 200 }).png().toFile(outputPath);

console.log(`Rendered ${outputPath}`);
process.exit(0);
