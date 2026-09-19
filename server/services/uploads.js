import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HttpError } from '../middleware/errors.js';

export function createUploadService(directory) {
  function path(id) {
    if (!/^upload-[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, 'Photo not found.');
    return resolve(directory, `${id}.webp`);
  }
  async function save(buffer) {
    if (!Buffer.isBuffer(buffer) || !buffer.length)
      throw new HttpError(400, 'Choose a photo to upload.');
    let result;
    try {
      const image = sharp(buffer, { limitInputPixels: 50_000_000 });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
        throw new Error('Unsupported format');
      }
      // Re-encode validated pixels, remove metadata, and correct phone-camera orientation.
      result = await image
        .rotate()
        .resize({ width: 4096, height: 4096, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new HttpError(
        400,
        'Choose a valid JPG, PNG, or still WebP photo (up to 50 megapixels). Convert HEIC photos to JPG first.',
      );
    }
    const id = `upload-${randomUUID()}`;
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(path(id), result.data, { flag: 'wx' });
    } catch (error) {
      await rm(path(id), { force: true });
      throw error;
    }
    return { id, width: result.info.width, height: result.info.height };
  }
  async function remove(id) {
    if (id.startsWith('upload-')) await rm(path(id), { force: true });
  }
  return { save, remove, path };
}
