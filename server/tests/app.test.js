import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../db.js';
import { createApp } from '../app.js';
import { createImageService } from '../services/images.js';

let db, server, base;
beforeEach(async () => {
  db = openDatabase(':memory:');
  server = createApp(db, { apiKey: '' }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});
function client() {
  let cookie = '';
  return async (path, method = 'GET', body, token, extraHeaders = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Frameboard': '1',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(token ? { 'X-Share-Token': token } : {}),
        ...extraHeaders,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.headers.get('set-cookie'))
      cookie = response.headers.get('set-cookie').split(';')[0];
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data, headers: response.headers };
  };
}
async function guest() {
  const call = client();
  const result = await call('/auth/session');
  assert.equal(result.status, 200);
  return call;
}
async function newBoard(call) {
  const result = await call('/boards', 'POST', {
    name: 'Test collection',
    description: 'A test board',
    color: '#dce5dc',
  });
  assert.equal(result.status, 201);
  return result.data;
}

test('guest sessions have separate workspaces and HttpOnly cookies', async () => {
  const a = client(),
    b = await guest();
  const session = await a('/auth/session');
  assert.match(session.headers.get('set-cookie'), /HttpOnly/);
  assert.match(session.headers.get('set-cookie'), /SameSite=Lax/);
  const own = (await a('/boards')).data.boards[0];
  assert.equal(own.count, 4);
  assert.equal((await b(`/boards/${own.id}`)).status, 404);
  assert.equal((await client()('/boards')).status, 401);
});

test('collections and pins support CRUD, duplicate saves, validation, and stale edit protection', async () => {
  const a = await guest(),
    board = await newBoard(a);
  assert.equal((await a('/boards', 'POST', { name: '   ' })).status, 400);
  const saved = await a(`/boards/${board.id}/pins`, 'POST', { imageId: 'sample-29' });
  assert.equal(saved.status, 201);
  const pin = saved.data.pin;
  assert.equal(
    (await a(`/boards/${board.id}/pins`, 'POST', { imageId: 'sample-29' })).data.alreadySaved,
    true,
  );
  assert.equal((await a(`/boards/${board.id}`)).data.count, 1);
  assert.equal(
    (
      await a(`/boards/${board.id}/pins/${pin.id}`, 'PATCH', {
        title: 'Mountain trip',
        note: 'Summer plans',
        version: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await a(`/boards/${board.id}/pins/${pin.id}`, 'PATCH', {
        title: 'Stale edit',
        note: '',
        version: 1,
      })
    ).status,
    409,
  );
  assert.equal((await a(`/boards/${board.id}`)).data.pins[0].note, 'Summer plans');
  assert.equal(
    (await a(`/boards/${board.id}`, 'PATCH', { name: 'New name', description: 'Updated' })).status,
    200,
  );
  assert.equal((await a(`/boards/${board.id}`)).data.name, 'New name');
  assert.equal((await a(`/boards/${board.id}/pins/${pin.id}`, 'DELETE')).status, 204);
  assert.equal((await a(`/boards/${board.id}`, 'DELETE')).status, 204);
  assert.equal((await a(`/boards/${board.id}`)).status, 404);
});

test('view links block writes; edit links permit collaboration; revoked links stop access', async () => {
  const owner = await guest(),
    visitor = await guest(),
    board = await newBoard(owner);
  let share = (await owner(`/boards/${board.id}/share`, 'PUT', { mode: 'view' })).data;
  assert.equal((await visitor(`/boards/shared/${share.shareToken}`)).data.role, 'viewer');
  assert.equal(
    (await visitor(`/boards/${board.id}/pins`, 'POST', { imageId: 'sample-10' }, share.shareToken))
      .status,
    403,
  );
  const oldToken = share.shareToken;
  share = (await owner(`/boards/${board.id}/share`, 'PUT', { mode: 'edit' })).data;
  assert.equal((await visitor(`/boards/shared/${oldToken}`)).status, 404);
  const result = await visitor(
    `/boards/${board.id}/pins`,
    'POST',
    { imageId: 'sample-10' },
    share.shareToken,
  );
  assert.equal(result.status, 201);
  assert.equal(
    (await visitor(`/boards/${board.id}`, 'DELETE', undefined, share.shareToken)).status,
    403,
  );
  assert.equal(
    (await visitor(`/boards/${board.id}/share`, 'PUT', { mode: 'private' }, share.shareToken))
      .status,
    403,
  );
  assert.equal(
    (
      await visitor(
        `/boards/${board.id}/pins/${result.data.pin.id}`,
        'PATCH',
        { title: 'Together', note: 'Shared note', version: 1 },
        share.shareToken,
      )
    ).status,
    200,
  );
  await owner(`/boards/${board.id}/share`, 'PUT', { mode: 'private' });
  assert.equal((await visitor(`/boards/shared/${share.shareToken}`)).status, 404);
  assert.equal(
    (
      await visitor(
        `/boards/${board.id}/pins/${result.data.pin.id}`,
        'DELETE',
        undefined,
        share.shareToken,
      )
    ).status,
    404,
  );
});

test('accounts retain guest collections, sign in from another session, and collaborate by account', async () => {
  const owner = await guest(),
    editor = await guest(),
    login = client();
  const board = await newBoard(owner);
  assert.equal(
    (
      await owner('/auth/register', 'POST', {
        name: 'Owner',
        email: 'owner@example.test',
        password: 'example-pass-123',
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await editor('/auth/register', 'POST', {
        name: 'Editor',
        email: 'editor@example.test',
        password: 'example-pass-456',
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await login('/auth/login', 'POST', {
        email: 'owner@example.test',
        password: 'wrong-password',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await login('/auth/login', 'POST', {
        email: 'OWNER@example.test',
        password: 'example-pass-123',
      })
    ).status,
    200,
  );
  assert.equal((await login(`/boards/${board.id}`)).data.role, 'owner');
  assert.equal(
    (await owner(`/boards/${board.id}/members`, 'POST', { email: 'editor@example.test' })).status,
    201,
  );
  assert.equal((await editor(`/boards/${board.id}`)).data.role, 'editor');
  assert.ok((await editor('/boards')).data.boards.some((b) => b.id === board.id));
  assert.equal(
    (await editor(`/boards/${board.id}/pins`, 'POST', { imageId: 'sample-42' })).status,
    201,
  );
  const member = (await owner(`/boards/${board.id}/members`)).data.members[0];
  await owner(`/boards/${board.id}/members/${member.id}`, 'DELETE');
  assert.equal((await editor(`/boards/${board.id}`)).status, 404);
  assert.equal((await login('/auth/logout', 'POST')).data.user.guest, true);
  assert.equal((await login(`/boards/${board.id}`)).status, 404);
  const stored = db.prepare('SELECT password FROM users WHERE email = ?').get('owner@example.test');
  assert.ok(!stored.password.includes('example-pass-123'));
});

test('sample search matches metadata and rejects malformed image IDs', async () => {
  const a = await guest(),
    board = await newBoard(a);
  const search = await a('/images?q=mountains');
  assert.equal(search.data.provider, 'samples');
  assert.ok(search.data.images.length > 0);
  assert.ok(search.data.images.every((image) => image.tags.includes('mountains')));
  assert.equal((await a('/images?q=no-such-photo-xyz')).data.images.length, 0);
  assert.equal((await a('/images?page=-1')).status, 400);
  assert.equal(
    (await a(`/boards/${board.id}/pins`, 'POST', { imageId: 'http://localhost/private' })).status,
    400,
  );
});

test('cross-site writes are rejected before mutation', async () => {
  const a = await guest();
  assert.equal(
    (
      await a('/boards', 'POST', { name: 'Blocked' }, undefined, {
        Origin: 'https://untrusted.example',
      })
    ).status,
    403,
  );
  assert.equal(
    (await a('/boards', 'POST', { name: 'Blocked' }, undefined, { 'X-Frameboard': '' })).status,
    403,
  );
});

test('SQLite data survives closing and reopening the database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameboard-db-')),
    file = join(dir, 'test.sqlite');
  let disk = openDatabase(file);
  disk.prepare('INSERT INTO users(id,name) VALUES (?,?)').run('persistent-user', 'Test');
  disk
    .prepare('INSERT INTO boards(id,owner_id,name) VALUES (?,?,?)')
    .run('persistent-board', 'persistent-user', 'Still here');
  disk.close();
  disk = openDatabase(file);
  assert.equal(
    disk.prepare('SELECT name FROM boards WHERE id = ?').get('persistent-board').name,
    'Still here',
  );
  disk.close();
  rmSync(dir, { recursive: true });
});

test('Pixabay search caches for 24 hours and saves images locally, using a mocked provider', async () => {
  let calls = 0;
  const dir = mkdtempSync(join(tmpdir(), 'frameboard-images-'));
  const fetcher = async (url) => {
    calls++;
    if (String(url).includes('/api/'))
      return new Response(
        JSON.stringify({
          totalHits: 1,
          hits: [
            {
              id: 123,
              tags: 'mountain, sky',
              webformatURL: 'https://cdn.pixabay.com/photo/test.jpg',
              pageURL: 'https://pixabay.com/photos/123/',
              user: 'Test',
              webformatWidth: 600,
              webformatHeight: 400,
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    return new Response(new Uint8Array([255, 216, 255, 217]), {
      headers: { 'content-type': 'image/jpeg' },
    });
  };
  const service = createImageService(db, { apiKey: 'test-key', fetcher, mediaDir: dir });
  assert.equal((await service.search('mountain')).images[0].id, 'pixabay-123');
  await service.search('mountain');
  assert.equal(calls, 1);
  assert.equal((await service.savedImage('pixabay-123')).url, '/media/pixabay-123.jpg');
  assert.ok(existsSync(join(dir, 'pixabay-123.jpg')));
  await service.savedImage('pixabay-123');
  assert.equal(calls, 2);
  rmSync(dir, { recursive: true });
});

test('remote image download rejects unexpected hosts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'frameboard-denied-'));
  db.prepare('INSERT INTO images VALUES (?,?)').run(
    'pixabay-999',
    JSON.stringify({ id: 'pixabay-999', url: 'http://127.0.0.1/private' }),
  );
  const service = createImageService(db, { apiKey: 'test-key', mediaDir: dir });
  await assert.rejects(service.savedImage('pixabay-999'), /Unsupported image source/);
  rmSync(dir, { recursive: true });
});
