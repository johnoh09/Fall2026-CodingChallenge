import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { samples, serverDir } from '../db.js';
import { HttpError } from '../middleware/errors.js';

const day = 24 * 60 * 60 * 1000;
export function createImageService(
  db,
  {
    apiKey = process.env.PIXABAY_API_KEY,
    fetcher = fetch,
    mediaDir = resolve(serverDir, 'data/media'),
  } = {},
) {
  async function search(query = '', page = 1) {
    if (!apiKey) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const matching = samples.filter((image) =>
        words.every((word) =>
          `${image.title} ${image.tags} ${image.author}`.toLowerCase().includes(word),
        ),
      );
      return {
        images: matching.slice((page - 1) * 24, page * 24),
        total: matching.length,
        page,
        provider: 'samples',
      };
    }
    const key = `${query.toLowerCase()}:${page}`;
    const cached = db
      .prepare('SELECT data FROM search_cache WHERE key = ? AND expires_at > ?')
      .get(key, Date.now());
    if (cached) return JSON.parse(cached.data);
    const url = new URL('https://pixabay.com/api/');
    for (const [name, value] of Object.entries({
      key: apiKey,
      q: query,
      page,
      per_page: 24,
      image_type: 'photo',
      safesearch: true,
    }))
      url.searchParams.set(name, String(value));
    let response;
    try {
      response = await fetcher(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      throw new HttpError(502, 'Image search is unavailable. Check your connection and try again.');
    }
    if (!response.ok)
      throw new HttpError(
        502,
        'Pixabay could not answer the search. Check your API key or try again later.',
      );
    const result = await response.json();
    const images = result.hits.map((hit) => ({
      id: `pixabay-${hit.id}`,
      title: hit.tags.split(',').slice(0, 2).join(','),
      tags: hit.tags,
      url: hit.webformatURL,
      sourceUrl: hit.pageURL,
      author: hit.user,
      width: hit.webformatWidth,
      height: hit.webformatHeight,
      provider: 'pixabay',
    }));
    const data = { images, total: result.totalHits, page, provider: 'pixabay' };
    db.prepare('INSERT OR REPLACE INTO search_cache VALUES (?, ?, ?)').run(
      key,
      JSON.stringify(data),
      Date.now() + day,
    );
    for (const image of images)
      db.prepare('INSERT OR REPLACE INTO images VALUES (?, ?)').run(
        image.id,
        JSON.stringify(image),
      );
    return data;
  }

  async function savedImage(id) {
    const sample = samples.find((image) => image.id === id);
    if (sample) return sample;
    const row = db.prepare('SELECT data FROM images WHERE id = ?').get(id);
    if (!row) throw new HttpError(400, 'Search for this image again before saving it.');
    const image = JSON.parse(row.data);
    // Never download a client-supplied URL. Only server-cached provider results are eligible.
    await mkdir(mediaDir, { recursive: true });
    for (const ext of ['jpg', 'png', 'webp']) {
      try {
        await access(resolve(mediaDir, `${id}.${ext}`));
        return { ...image, url: `/media/${id}.${ext}` };
      } catch {
        /* Not saved yet. */
      }
    }
    let url = new URL(image.url),
      response;
    for (let redirect = 0; redirect < 4; redirect++) {
      if (url.protocol !== 'https:' || !['pixabay.com', 'cdn.pixabay.com'].includes(url.hostname))
        throw new HttpError(400, 'Unsupported image source.');
      try {
        response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      } catch {
        throw new HttpError(502, 'Could not download the image. Please search again and retry.');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        url = new URL(response.headers.get('location'), url);
        continue;
      }
      break;
    }
    const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const ext = extensions[response?.headers.get('content-type')?.split(';')[0]];
    if (!response?.ok || !ext)
      throw new HttpError(502, 'The image could not be downloaded. Search again to refresh it.');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 10 * 1024 * 1024) throw new HttpError(413, 'This image is too large to save.');
      chunks.push(chunk);
    }
    await writeFile(resolve(mediaDir, `${id}.${ext}`), Buffer.concat(chunks));
    return { ...image, url: `/media/${id}.${ext}` };
  }
  return { search, savedImage, mediaDir };
}
