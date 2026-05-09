import fs from 'node:fs';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'server', 'data');
export const UPLOADS_DIR = path.join(PROJECT_ROOT, 'server', 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'lhb-markup.db');

export function ensurePrototypeStorage() {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  fs.mkdirSync(UPLOADS_DIR, {recursive: true});
}

export function sanitizeFileName(input) {
  const baseName = path.basename(String(input || 'upload.bin'));
  const cleaned = baseName.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+/, '');
  return cleaned || 'upload.bin';
}

export function resolveUploadPath(fileRef) {
  const normalized = path.posix.normalize(String(fileRef || ''));
  if (!normalized.startsWith('uploads/')) {
    throw new Error('Invalid upload reference');
  }
  const relativeName = normalized.slice('uploads/'.length);
  if (!relativeName || relativeName.includes('..') || relativeName.includes('/')) {
    throw new Error('Invalid upload reference');
  }

  const absolutePath = path.join(UPLOADS_DIR, relativeName);
  const safePrefix = `${UPLOADS_DIR}${path.sep}`;
  if (!absolutePath.startsWith(safePrefix)) {
    throw new Error('Invalid upload reference');
  }
  return absolutePath;
}

export async function storeUploadFromRequest(req, originalName = 'upload.bin') {
  ensurePrototypeStorage();
  const stamped = new Date().toISOString().replace(/[:.]/g, '-');
  const storedName = `${stamped}-${randomUUID().slice(0, 12)}-${sanitizeFileName(originalName)}`;
  const absolutePath = path.join(UPLOADS_DIR, storedName);

  await pipeline(req, createWriteStream(absolutePath));

  const stats = await fs.promises.stat(absolutePath);
  return {
    fileRef: `uploads/${storedName}`,
    storedName,
    absolutePath,
    size: stats.size,
  };
}

export async function storeUploadFromBuffer(buffer, originalName = 'upload.bin') {
  ensurePrototypeStorage();
  const stamped = new Date().toISOString().replace(/[:.]/g, '-');
  const storedName = `${stamped}-${randomUUID().slice(0, 12)}-${sanitizeFileName(originalName)}`;
  const absolutePath = path.join(UPLOADS_DIR, storedName);

  await fs.promises.writeFile(absolutePath, buffer);

  const stats = await fs.promises.stat(absolutePath);
  return {
    fileRef: `uploads/${storedName}`,
    storedName,
    absolutePath,
    size: stats.size,
  };
}

export async function readJsonBody(req, maxBytes = 5 * 1024 * 1024) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('Request body too large');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) {
    return null;
  }
  return JSON.parse(raw);
}

export function readFileRefStats(fileRef) {
  const absolutePath = resolveUploadPath(fileRef);
  return fs.promises.stat(absolutePath);
}

export async function deleteUploadRef(fileRef) {
  const absolutePath = resolveUploadPath(fileRef);
  await fs.promises.unlink(absolutePath);
}
