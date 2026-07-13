import { spawnSync } from "node:child_process";
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").pop() || "moji-mic";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || `/${repositoryName}`;
const outputDir = path.join(projectRoot, "out");
const publishDir = path.join(projectRoot, "docs");
const nextBuildDir = path.join(projectRoot, ".next");

if (!/^\/[A-Za-z0-9._-]+$/.test(basePath)) {
  throw new Error(`Invalid GitHub Pages base path: ${basePath}`);
}

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
// Next's Webpack pipeline emits module workers as browser-ready JavaScript.
// Turbopack currently copies this TypeScript worker as a raw asset on export.
await Promise.all([
  rm(outputDir, { recursive: true, force: true }),
  rm(nextBuildDir, { recursive: true, force: true }),
]);
const build = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    GITHUB_PAGES: "true",
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  stdio: "inherit",
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const indexHtml = await readFile(path.join(outputDir, "index.html"), "utf8");
const serviceWorker = await readFile(path.join(outputDir, "sw.js"), "utf8");
const manifest = JSON.parse(await readFile(path.join(outputDir, "manifest.webmanifest"), "utf8"));

for (const expected of [
  `${basePath}/_next/`,
  `${basePath}/manifest.webmanifest`,
  `${basePath}/icon-192.png`,
]) {
  if (!indexHtml.includes(expected)) {
    throw new Error(`GitHub Pages build is missing ${expected} in index.html`);
  }
}

if (manifest.start_url !== "./" || manifest.scope !== "./") {
  throw new Error("Web app manifest must use paths relative to its deployed directory");
}
if (!serviceWorker.includes("self.registration.scope")) {
  throw new Error("Service worker is not deriving its root from the registration scope");
}

const chunksDir = path.join(outputDir, "_next", "static", "chunks");
const chunkFiles = (await readdir(chunksDir, { recursive: true }))
  .filter((file) => file.endsWith(".js"));
let serviceWorkerPathFound = false;
let transcriberWorkerFound = false;
let cachedRuntimeFound = false;
for (const file of chunkFiles) {
  const source = await readFile(path.join(chunksDir, file), "utf8");
  if (source.includes(basePath) && source.includes("/sw.js")) {
    serviceWorkerPathFound = true;
  }
  if (source.includes("automatic-speech-recognition") && source.includes("addEventListener")) {
    transcriberWorkerFound = true;
  }
  if (source.includes("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/")) {
    cachedRuntimeFound = true;
  }
}
if (!serviceWorkerPathFound) {
  throw new Error(`Client bundle is missing the scoped service worker URL ${basePath}/sw.js`);
}
if (!transcriberWorkerFound) {
  throw new Error("Transcription worker was not emitted as browser-ready JavaScript");
}
if (!cachedRuntimeFound || !serviceWorker.includes("https://cdn.jsdelivr.net")) {
  throw new Error("The external AI runtime is not configured for offline caching");
}

// Transformers.js uses the explicitly versioned CDN path above, so Webpack's
// unused 22 MB ONNX fallback does not need to be stored in this repository.
const mediaDir = path.join(outputDir, "_next", "static", "media");
const unusedRuntimeFiles = (await readdir(mediaDir))
  .filter((file) => file.startsWith("ort-wasm-") || file.startsWith("ort.bundle."));
await Promise.all(unusedRuntimeFiles.map((file) => rm(path.join(mediaDir, file))));

await writeFile(path.join(outputDir, ".nojekyll"), "");
await rm(publishDir, { recursive: true, force: true });
await cp(outputDir, publishDir, { recursive: true });
console.log(`Generated build-free GitHub Pages site in docs/ for ${basePath}/`);
