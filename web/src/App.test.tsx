import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import React from 'react';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
// Backend integration is intentionally real: only the HTTP origin/cookie transport is adapted for jsdom.
// @ts-expect-error The workshop backend is JavaScript, while the frontend is TypeScript.
import { openDatabase } from '../../server/db.js';
// @ts-expect-error See above.
import { createApp } from '../../server/app.js';
import App from './App';

const realFetch = globalThis.fetch;
let uploadsDir: string;
let server: ReturnType<ReturnType<typeof createApp>['listen']>, db: ReturnType<typeof openDatabase>;
beforeEach(async () => {
  uploadsDir = mkdtempSync(join(tmpdir(), 'frameboard-ui-'));
  db = openDatabase(':memory:');
  server = createApp(db, { apiKey: '', uploadsDir }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
    // jsdom and Node use different AbortSignal classes; preserve cancellation
    // at the adapter boundary without passing a foreign-realm signal to undici.
    const { signal, ...transport } = options;
    signal?.throwIfAborted();
    const response = await realFetch(base + url, {
      ...transport,
      headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) },
    });
    signal?.throwIfAborted();
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return response;
  });
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await new Promise<void>((resolve) => server.close(resolve));
  db.close();
  rmSync(uploadsDir, { recursive: true, force: true });
});
const launch = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

test('opens the workspace and searches the real sample library', async () => {
  const user = userEvent.setup();
  launch();
  await screen.findByText('16 finds');
  expect(screen.getAllByRole('article')).toHaveLength(16);
  await user.type(screen.getByRole('textbox', { name: 'Search images' }), 'mountains');
  await user.click(screen.getByRole('button', { name: 'Explore', exact: true }));
  await waitFor(() => expect(screen.getAllByRole('article').length).toBe(4));
  expect(screen.getByRole('button', { name: 'Open Somewhere above the clouds' })).toBeTruthy();
});

test('creates a collection, saves a photo, edits its note, and removes it', async () => {
  const user = userEvent.setup();
  launch();
  await screen.findByText('16 finds');
  await user.click(screen.getAllByRole('button', { name: 'New collection', exact: true }).at(-1)!);
  const create = await screen.findByRole('dialog');
  await user.type(within(create).getByLabelText(/Collection name/), 'Weekend ideas');
  await user.click(within(create).getByRole('button', { name: 'Create collection', exact: true }));
  await screen.findByRole('heading', { name: 'Weekend ideas' });
  await user.click(screen.getByRole('button', { name: 'Add images', exact: true }));
  await screen.findByText('16 finds');
  await user.click(
    within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Save', exact: true }),
  );
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Save image',
      exact: true,
    }),
  );
  await screen.findByText('Saved to Weekend ideas.');
  await user.click(screen.getByRole('button', { name: 'Done adding' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  const edit = await screen.findByRole('dialog');
  await user.clear(within(edit).getByLabelText('Title'));
  await user.type(within(edit).getByLabelText('Title'), 'My weekend');
  await user.type(within(edit).getByLabelText('A note to remember'), 'Bring a camera.');
  await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
  await screen.findByRole('button', { name: 'Open My weekend' });
  await user.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  const updated = await screen.findByRole('dialog');
  expect((within(updated).getByLabelText('A note to remember') as HTMLTextAreaElement).value).toBe(
    'Bring a camera.',
  );
  await user.click(within(updated).getByRole('button', { name: 'Remove from collection' }));
  await user.click(within(updated).getByRole('button', { name: 'Remove image', exact: true }));
  await screen.findByRole('heading', { name: 'A fresh page for your ideas.' });
});

test('sharing UI creates and revokes a real collection link', async () => {
  const user = userEvent.setup();
  launch('/collections');
  await screen.findByRole('heading', { name: 'First finds' });
  await user.click(
    screen
      .getAllByRole('link')
      .find(
        (link) => link.textContent?.includes('First finds') && link.className === 'board-card',
      )!,
  );
  await user.click(await screen.findByRole('button', { name: 'Share', exact: true }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Can edit' }));
  const link = await within(dialog).findByLabelText('Share link');
  await waitFor(() =>
    expect((link as HTMLInputElement).value).toMatch(
      /^http:\/\/localhost:5173\/share\/[a-f0-9]{48}$/,
    ),
  );
  await user.click(within(dialog).getByRole('button', { name: 'Link off' }));
  await waitFor(() => expect(within(dialog).queryByLabelText('Share link')).toBeNull());
  expect(db.prepare('SELECT share_mode FROM boards LIMIT 1').get().share_mode).toBe('private');
});

test('selects a local photo, previews it, and saves it to the chosen collection', async () => {
  const user = userEvent.setup();
  const NativeURL = URL;
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL() {
        return 'blob:test-preview';
      }
      static revokeObjectURL() {}
    },
  );
  launch();
  await screen.findByText('16 finds');
  await user.click(screen.getByRole('button', { name: 'Upload photo', exact: true }));
  const dialog = await screen.findByRole('dialog');
  const bytes = readFileSync(new NativeURL('../public/samples/29.jpg', import.meta.url));
  const file = new File([bytes], 'my-trip.jpg', { type: 'image/jpeg' });
  // jsdom's File lacks arrayBuffer; adapt this test fixture to the browser File API.
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  await user.upload(within(dialog).getByLabelText('Choose photo'), file);
  expect(within(dialog).getByAltText('Selected photo preview')).toBeTruthy();
  await user.clear(within(dialog).getByLabelText(/Photo title/));
  await user.type(within(dialog).getByLabelText(/Photo title/), 'My own photo');
  await user.click(within(dialog).getByRole('button', { name: 'Upload & save' }));
  await screen.findByRole('button', { name: 'Open My own photo' });
  const pin = db.prepare("SELECT * FROM pins WHERE title = 'My own photo'").get();
  expect(pin.image_id).toMatch(/^upload-/);
  expect(pin.url).toMatch(/\/api\/boards\/.*\/uploads\/upload-/);
});
