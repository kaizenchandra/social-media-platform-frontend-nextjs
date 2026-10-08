import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(join(directory, entry.name))
          : [join(directory, entry.name)],
      ),
    )
  ).flat();
}
const chunks = [];
for (const file of await files(".next/static/chunks")) {
  if (!file.endsWith(".js")) continue;
  const bytes = await readFile(file);
  chunks.push({
    file: relative(".next", file),
    rawBytes: bytes.length,
    gzipBytes: gzipSync(bytes).length,
  });
}
const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]));
const routes = [];
for (const file of await files(".next/server/app")) {
  if (!file.endsWith("_client-reference-manifest.js")) continue;
  const manifest = await readFile(file, "utf8");
  const references = [
    ...new Set(manifest.match(/static\/chunks\/[^"\\\s]+\.js/g) ?? []),
  ];
  const assets = references.map((name) => byFile.get(name)).filter(Boolean);
  routes.push({
    route: relative(".next/server/app", file)
      .replace(/\/page_client-reference-manifest\.js$/, "")
      .replace(/^page_client-reference-manifest\.js$/, "/"),
    referencedChunks: assets.length,
    rawBytes: assets.reduce((total, item) => total + item.rawBytes, 0),
    gzipBytes: assets.reduce((total, item) => total + item.gzipBytes, 0),
  });
}
const report = {
  generatedAt: new Date().toISOString(),
  buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
  method:
    "Client-reference assets deduplicated per route; these subtotals exclude runtime/framework assets absent from that manifest and are not total page weight. All emitted chunks counted once in total. Gzip estimates are not measured transfer or execution. No approved bundle budget exists.",
  total: {
    chunks: chunks.length,
    rawBytes: chunks.reduce((total, item) => total + item.rawBytes, 0),
    gzipBytes: chunks.reduce((total, item) => total + item.gzipBytes, 0),
  },
  largestChunks: chunks.sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 10),
  routes,
};
await writeFile(
  process.argv[2] ?? "docs/verification/phase-13-bundle.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    { total: report.total, largestChunks: report.largestChunks.slice(0, 3) },
    null,
    2,
  ),
);
