import { Router, raw } from 'express';
import { resolve } from 'node:path';
import { createUploadService } from '../services/uploads.js';
import { randomUUID, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { touchBoard, transaction, serverDir } from '../db.js';
import { HttpError } from '../middleware/errors.js';

const boardInput = z.object({
  name: z.string().trim().min(1, 'Give your collection a name.').max(80),
  description: z.string().trim().max(500).default(''),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#dce5dc'),
});
const pinEdit = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(160),
  note: z.string().trim().max(2000),
  version: z.number().int().positive(),
});
function pinData(pin, token) {
  return {
    id: pin.id,
    imageId: pin.image_id,
    title: pin.title,
    note: pin.note,
    url:
      pin.image_id.startsWith('upload-') && token
        ? `${pin.url}?share=${encodeURIComponent(token)}`
        : pin.url,
    sourceUrl: pin.source_url,
    author: pin.author,
    width: pin.width,
    height: pin.height,
    version: pin.version,
  };
}

export function boardRoutes(db, images, options = {}) {
  const uploads = createUploadService(options.uploadsDir || resolve(serverDir, 'data/uploads'));
  const router = Router();
  function getAccess(req, id) {
    const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
    if (!board) throw new HttpError(404, 'Collection not found.');
    let role;
    if (board.owner_id === req.user.id) role = 'owner';
    else if (
      db.prepare('SELECT 1 FROM members WHERE board_id = ? AND user_id = ?').get(id, req.user.id)
    )
      role = 'editor';
    else if (
      board.share_mode !== 'private' &&
      board.share_token &&
      req.get('X-Share-Token') === board.share_token
    )
      role = board.share_mode === 'edit' ? 'editor' : 'viewer';
    if (!role) throw new HttpError(404, 'Collection not found or no longer shared.');
    return { board, role };
  }
  function needEdit(access) {
    if (access.role === 'viewer') throw new HttpError(403, 'This link is view only.');
  }
  function needOwner(access) {
    if (access.role !== 'owner')
      throw new HttpError(403, 'Only the owner can change this setting.');
  }
  function boardData(board, role, detail = false, token) {
    const pins = db
      .prepare('SELECT * FROM pins WHERE board_id = ? ORDER BY created_at DESC, rowid DESC')
      .all(board.id)
      .map((pin) => pinData(pin, token));
    return {
      id: board.id,
      name: board.name,
      description: board.description,
      color: board.color,
      role,
      revision: board.revision,
      shareMode: board.share_mode,
      shareToken: role === 'owner' ? board.share_token : undefined,
      count: pins.length,
      covers: pins.slice(0, 4).map((pin) => pin.url),
      ...(detail ? { pins } : {}),
    };
  }
  router.get('/', (req, res) => {
    const boards = db
      .prepare(
        `SELECT DISTINCT b.* FROM boards b LEFT JOIN members m ON m.board_id = b.id
      WHERE b.owner_id = ? OR m.user_id = ? ORDER BY b.updated_at DESC, b.rowid DESC`,
      )
      .all(req.user.id, req.user.id);
    res.json({
      boards: boards.map((board) =>
        boardData(board, board.owner_id === req.user.id ? 'owner' : 'editor'),
      ),
    });
  });
  router.post('/', (req, res) => {
    const data = boardInput.parse(req.body),
      id = randomUUID();
    db.prepare('INSERT INTO boards(id,owner_id,name,description,color) VALUES (?,?,?,?,?)').run(
      id,
      req.user.id,
      data.name,
      data.description,
      data.color,
    );
    res
      .status(201)
      .json(boardData(db.prepare('SELECT * FROM boards WHERE id = ?').get(id), 'owner', true));
  });
  router.get('/shared/:token', (req, res) => {
    const board = db
      .prepare("SELECT * FROM boards WHERE share_token = ? AND share_mode != 'private'")
      .get(req.params.token);
    if (!board) throw new HttpError(404, 'This share link is unavailable or has been turned off.');
    req.headers['x-share-token'] = req.params.token;
    const access = getAccess(req, board.id);
    res.json(boardData(board, access.role, true, req.params.token));
  });
  router.get('/:id', (req, res) => {
    const { board, role } = getAccess(req, req.params.id);
    res.json(boardData(board, role, true, req.get('X-Share-Token')));
  });
  router.patch('/:id', (req, res) => {
    const access = getAccess(req, req.params.id);
    needOwner(access);
    const data = boardInput.parse(req.body);
    transaction(db, () => {
      db.prepare('UPDATE boards SET name = ?, description = ?, color = ? WHERE id = ?').run(
        data.name,
        data.description,
        data.color,
        access.board.id,
      );
      touchBoard(db, access.board.id);
    });
    res.json({ ok: true });
  });
  router.delete('/:id', async (req, res) => {
    const access = getAccess(req, req.params.id);
    needOwner(access);
    const removedPins = db
      .prepare('SELECT image_id FROM pins WHERE board_id = ?')
      .all(access.board.id);
    db.prepare('DELETE FROM boards WHERE id = ?').run(access.board.id);
    await Promise.all(removedPins.map((pin) => uploads.remove(pin.image_id)));
    res.status(204).end();
  });
  router.put('/:id/share', (req, res) => {
    const access = getAccess(req, req.params.id);
    needOwner(access);
    const { mode } = z.object({ mode: z.enum(['private', 'view', 'edit']) }).parse(req.body);
    const token = mode === 'private' ? null : randomBytes(24).toString('hex');
    db.prepare(
      'UPDATE boards SET share_mode = ?, share_token = ?, revision = revision + 1 WHERE id = ?',
    ).run(mode, token, access.board.id);
    res.json({ shareToken: token, shareMode: mode });
  });
  router.get('/:id/members', (req, res) => {
    const access = getAccess(req, req.params.id);
    needOwner(access);
    const members = db
      .prepare(
        'SELECT u.id, u.name, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.board_id = ?',
      )
      .all(access.board.id);
    res.json({ members });
  });
  router.post('/:id/members', (req, res) => {
    const access = getAccess(req, req.params.id);
    needOwner(access);
    const { email } = z
      .object({ email: z.email().transform((v) => v.toLowerCase()) })
      .parse(req.body);
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) throw new HttpError(404, 'Ask this person to create a Frameboard account first.');
    if (user.id === req.user.id) throw new HttpError(400, 'You already own this collection.');
    db.prepare('INSERT OR IGNORE INTO members VALUES (?, ?)').run(access.board.id, user.id);
    touchBoard(db, access.board.id);
    res.status(201).json({ ok: true });
  });
  router.delete('/:id/members/:userId', (req, res) => {
    const access = getAccess(req, req.params.id);
    needOwner(access);
    db.prepare('DELETE FROM members WHERE board_id = ? AND user_id = ?').run(
      access.board.id,
      req.params.userId,
    );
    touchBoard(db, access.board.id);
    res.status(204).end();
  });
  router.post(
    '/:id/uploads',
    (req, res, next) => {
      needEdit(getAccess(req, req.params.id));
      if (
        !['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'].includes(
          req.get('Content-Type')?.split(';')[0],
        )
      ) {
        throw new HttpError(415, 'Upload a JPG, PNG, or WebP photo.');
      }
      next();
    },
    raw({ type: () => true, limit: '10mb' }),
    async (req, res) => {
      const title = z
        .string()
        .trim()
        .min(1, 'Enter a photo title.')
        .max(160)
        .parse(req.query.title || 'My photo');
      const image = await uploads.save(req.body);
      const id = randomUUID();
      try {
        // Decoding is asynchronous; permissions may have changed in the meantime.
        needEdit(getAccess(req, req.params.id));
        transaction(db, () => {
          db.prepare(
            `INSERT INTO pins(id,board_id,image_id,title,url,source_url,author,width,height) VALUES(?,?,?,?,?,?,?,?,?)`,
          ).run(
            id,
            req.params.id,
            image.id,
            title,
            `/api/boards/${req.params.id}/uploads/${image.id}`,
            '',
            req.user.email ? req.user.name : 'Your upload',
            image.width,
            image.height,
          );
          touchBoard(db, req.params.id);
        });
      } catch (error) {
        await uploads.remove(image.id);
        throw error;
      }
      res.status(201).json({
        pin: pinData(
          db.prepare('SELECT * FROM pins WHERE id = ?').get(id),
          req.get('X-Share-Token'),
        ),
      });
    },
  );
  router.get('/:id/uploads/:imageId', (req, res, next) => {
    if (typeof req.query.share === 'string') req.headers['x-share-token'] = req.query.share;
    getAccess(req, req.params.id);
    const pin = db
      .prepare('SELECT id FROM pins WHERE board_id = ? AND image_id = ?')
      .get(req.params.id, req.params.imageId);
    if (!pin) throw new HttpError(404, 'Photo not found.');
    res.set('Cache-Control', 'private, no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.sendFile(uploads.path(req.params.imageId), { cacheControl: false }, (error) => {
      if (error) next(new HttpError(error.status || 500, 'Photo not found.'));
    });
  });
  router.post('/:id/pins', async (req, res) => {
    needEdit(getAccess(req, req.params.id));
    const { imageId } = z
      .object({ imageId: z.string().regex(/^(sample|pixabay)-\d+$/) })
      .parse(req.body);
    const existing = db
      .prepare('SELECT * FROM pins WHERE board_id = ? AND image_id = ?')
      .get(req.params.id, imageId);
    if (existing) return res.json({ pin: pinData(existing), alreadySaved: true });
    const image = await images.savedImage(imageId);
    // Downloading yields to other requests: recheck permissions in case sharing was revoked.
    needEdit(getAccess(req, req.params.id));
    const id = randomUUID();
    transaction(db, () => {
      const result = db
        .prepare(
          `INSERT OR IGNORE INTO pins(id,board_id,image_id,title,url,source_url,author,width,height) VALUES(?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          req.params.id,
          imageId,
          image.title.slice(0, 160),
          image.url,
          image.sourceUrl,
          image.author,
          image.width,
          image.height,
        );
      if (result.changes) touchBoard(db, req.params.id);
    });
    const pin = db
      .prepare('SELECT * FROM pins WHERE board_id = ? AND image_id = ?')
      .get(req.params.id, imageId);
    res.status(pin.id === id ? 201 : 200).json({ pin: pinData(pin), alreadySaved: pin.id !== id });
  });
  router.patch('/:id/pins/:pinId', (req, res) => {
    needEdit(getAccess(req, req.params.id));
    const data = pinEdit.parse(req.body);
    const pin = db
      .prepare('SELECT * FROM pins WHERE id = ? AND board_id = ?')
      .get(req.params.pinId, req.params.id);
    if (!pin) throw new HttpError(404, 'This image has been removed.');
    if (pin.version !== data.version)
      throw new HttpError(
        409,
        'Someone edited this image. Close this window and reopen it to see the latest version.',
      );
    transaction(db, () => {
      db.prepare('UPDATE pins SET title = ?, note = ?, version = version + 1 WHERE id = ?').run(
        data.title,
        data.note,
        pin.id,
      );
      touchBoard(db, req.params.id);
    });
    res.json({ ok: true });
  });
  router.delete('/:id/pins/:pinId', async (req, res) => {
    needEdit(getAccess(req, req.params.id));
    const removedPin = db
      .prepare('SELECT image_id FROM pins WHERE id = ? AND board_id = ?')
      .get(req.params.pinId, req.params.id);
    const result = db
      .prepare('DELETE FROM pins WHERE id = ? AND board_id = ?')
      .run(req.params.pinId, req.params.id);
    if (!result.changes) throw new HttpError(404, 'This image has already been removed.');
    await uploads.remove(removedPin.image_id);
    touchBoard(db, req.params.id);
    res.status(204).end();
  });
  return router;
}
