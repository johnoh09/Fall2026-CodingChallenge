import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { openDatabase } from '../db.js';
import { createApp } from '../app.js';

let db, server, base, directory;
const photo = readFileSync(new URL('../../web/public/samples/29.jpg', import.meta.url));
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'frameboard-uploads-'));
  db = openDatabase(':memory:');
  server = createApp(db, { apiKey: '', uploadsDir: directory }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
async function guest() {
  const session = await fetch(`${base}/api/auth/session`);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  return async (path, method = 'GET', body, token, contentType) =>
    fetch(base + path, {
      method,
      headers: {
        Cookie: cookie,
        'X-Frameboard': '1',
        'Content-Type': contentType || 'application/json',
        ...(token ? { 'X-Share-Token': token } : {}),
      },
      ...(body !== undefined ? { body: contentType ? body : JSON.stringify(body) } : {}),
    });
}
async function boardFor(call) {
  const response = await call('/api/boards', 'POST', { name: 'Personal photos' });
  return response.json();
}

test('uploads a real photo, persists a decoded image, protects access, and cleans up on deletion', async () => {
  const owner = await guest(),
    other = await guest(),
    board = await boardFor(owner);
  const response = await owner(
    `/api/boards/${board.id}/uploads?title=My%20trip`,
    'POST',
    photo,
    undefined,
    'image/jpeg',
  );
  assert.equal(response.status, 201);
  const { pin } = await response.json();
  assert.equal(pin.title, 'My trip');
  assert.equal(pin.sourceUrl, '');
  const image = await owner(pin.url);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('cache-control'), /no-store/);
  const metadata = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.width, pin.width);
  assert.equal((await other(pin.url)).status, 404);
  assert.equal(readdirSync(directory).length, 1);
  const savedBoard = await (await owner(`/api/boards/${board.id}`)).json();
  assert.equal(savedBoard.count, 1);
  assert.ok(savedBoard.revision > 1);
  assert.equal((await owner(`/api/boards/${board.id}/pins/${pin.id}`, 'DELETE')).status, 204);
  assert.equal((await owner(pin.url)).status, 404);
  assert.equal(readdirSync(directory).length, 0);
});

test('shared photo reads and uploads obey view/edit permissions and link revocation', async () => {
  const owner = await guest(),
    visitor = await guest(),
    board = await boardFor(owner);
  await owner(`/api/boards/${board.id}/uploads`, 'POST', photo, undefined, 'image/jpeg');
  const { shareToken } = await (
    await owner(`/api/boards/${board.id}/share`, 'PUT', { mode: 'view' })
  ).json();
  const shared = await (await visitor(`/api/boards/shared/${shareToken}`)).json();
  assert.equal((await visitor(shared.pins[0].url)).status, 200);
  assert.equal(
    (await visitor(`/api/boards/${board.id}/uploads`, 'POST', photo, shareToken, 'image/jpeg'))
      .status,
    403,
  );
  const edit = await (await owner(`/api/boards/${board.id}/share`, 'PUT', { mode: 'edit' })).json();
  assert.equal((await visitor(shared.pins[0].url)).status, 404);
  assert.equal(
    (await visitor(`/api/boards/${board.id}/uploads`, 'POST', photo, edit.shareToken, 'image/jpeg'))
      .status,
    201,
  );
  assert.equal(readdirSync(directory).length, 2);
  await owner(`/api/boards/${board.id}`, 'DELETE');
  assert.equal(readdirSync(directory).length, 0);
});

test('rejects disguised non-images, empty files, unsupported files, and files over 10 MB', async () => {
  const owner = await guest(),
    board = await boardFor(owner);
  const path = `/api/boards/${board.id}/uploads`;
  assert.equal(
    (await owner(path, 'POST', Buffer.from('<svg/>'), undefined, 'image/jpeg')).status,
    400,
  );
  assert.equal((await owner(path, 'POST', Buffer.alloc(0), undefined, 'image/png')).status, 400);
  assert.equal(
    (await owner(path, 'POST', Buffer.from('HEIC'), undefined, 'image/heic')).status,
    415,
  );
  assert.equal(
    (await owner(path, 'POST', Buffer.alloc(10 * 1024 * 1024 + 1), undefined, 'image/jpeg')).status,
    413,
  );
  assert.equal(readdirSync(directory).length, 0);
});
