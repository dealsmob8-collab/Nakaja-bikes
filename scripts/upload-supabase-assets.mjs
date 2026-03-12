#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const DEFAULT_SOURCE_DIR = "/home/paulaflare/Desktop/images";
const DEFAULT_BUCKET = "nakaja-assets";
const MANIFEST_PATH = path.join(PROJECT_ROOT, "assets", "supabase-storage-manifest.json");

function parseDotenv(text) {
  const values = {};

  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  });

  return values;
}

async function loadVars() {
  const candidates = [".dev.vars", ".dev.vars.example"];

  for (const filename of candidates) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filename);
      const content = await readFile(fullPath, "utf8");
      return { filename, values: parseDotenv(content) };
    } catch (_) {}
  }

  throw new Error("No .dev.vars or .dev.vars.example file found in the project root.");
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  };

  return types[ext] || "application/octet-stream";
}

function encodeObjectPath(objectPath) {
  return objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function listImageFiles(sourceDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const fullPath = path.join(sourceDir, entry.name);
    const extension = path.extname(entry.name).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp", ".svg"].includes(extension)) continue;

    const fileStat = await stat(fullPath);
    files.push({
      name: entry.name,
      fullPath,
      size: fileStat.size
    });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function ensureBucket({ supabaseUrl, authKey, bucket }) {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: true
    })
  });

  if (response.ok) return { created: true };

  const bodyText = await response.text();
  if (response.status === 409 || /already exists|duplicate/i.test(bodyText)) {
    return { created: false };
  }

  throw new Error(`Bucket creation failed (${response.status}): ${bodyText.slice(0, 400)}`);
}

async function uploadFile({ supabaseUrl, authKey, bucket, file }) {
  const objectPath = file.name;
  const body = await readFile(file.fullPath);
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeObjectPath(objectPath)}`,
    {
      method: "POST",
      headers: {
        apikey: authKey,
        Authorization: `Bearer ${authKey}`,
        "Content-Type": getMimeType(file.fullPath),
        "x-upsert": "true"
      },
      body
    }
  );

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Upload failed for ${file.name} (${response.status}): ${bodyText.slice(0, 400)}`);
  }

  return {
    fileName: file.name,
    localPath: file.fullPath,
    bytes: file.size,
    objectPath,
    publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeObjectPath(objectPath)}`
  };
}

async function main() {
  const sourceDir = process.argv[2] || DEFAULT_SOURCE_DIR;
  const bucket = process.argv[3] || DEFAULT_BUCKET;
  const { filename, values } = await loadVars();
  const supabaseUrl = values.SUPABASE_URL;
  const authKey = values.SUPABASE_SECRET_KEY || values.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(`SUPABASE_URL is missing in ${filename}.`);
  }

  if (!authKey) {
    throw new Error(`SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing in ${filename}.`);
  }

  const files = await listImageFiles(sourceDir);
  if (!files.length) {
    throw new Error(`No image files found in ${sourceDir}.`);
  }

  const bucketResult = await ensureBucket({ supabaseUrl, authKey, bucket });
  const uploaded = [];

  for (const file of files) {
    const asset = await uploadFile({ supabaseUrl, authKey, bucket, file });
    uploaded.push(asset);
    console.log(`uploaded ${asset.fileName}`);
  }

  const manifest = {
    bucket,
    sourceDir,
    uploadedAt: new Date().toISOString(),
    bucketCreated: bucketResult.created,
    fileCount: uploaded.length,
    assets: uploaded
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`bucket=${bucket}`);
  console.log(`file_count=${uploaded.length}`);
  console.log(`manifest=${MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
