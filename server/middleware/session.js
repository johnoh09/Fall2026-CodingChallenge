import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { transaction, samples } from '../db.js';
import { HttpError } from './errors.js';

const lifetime = 30 * 24 * 60 * 60 * 1000;
const hash = (token) => createHash('sha256').update(token).digest('hex');
export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  guest: !user.email,
});

export function issueSession(db, res, userId, oldToken) {
  if (oldToken) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(oldToken));
  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(
    hash(token),
    userId,
    Date.now() + lifetime,
  );
  res.cookie('frameboard_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: lifetime,
    path: '/',
  });
}

export function sessionMiddleware(db) {
  return (req, res, next) => {
    const token = req.cookies.frameboard_session;
    if (typeof token === 'string')
      req.user = db
        .prepare(
          `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE token_hash = ? AND expires_at > ?`,
        )
        .get(hash(token), Date.now());
    next();
  };
}
export function requireUser(req, res, next) {
  if (!req.user) throw new HttpError(401, 'Your session expired. Refresh the page to continue.');
  next();
}
export function createGuest(db, res, oldToken) {
  const id = randomUUID();
  transaction(db, () => {
    db.prepare('INSERT INTO users(id, name) VALUES (?, ?)').run(id, 'Your workspace');
    const boardId = randomUUID();
    db.prepare('INSERT INTO boards(id, owner_id, name, description) VALUES (?, ?, ?, ?)').run(
      boardId,
      id,
      'First finds',
      'A little inspiration to get you started. Make this collection your own.',
    );
    for (const sample of samples.slice(0, 4)) {
      db.prepare(
        `INSERT INTO pins(id,board_id,image_id,title,url,source_url,author,width,height)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(
        randomUUID(),
        boardId,
        sample.id,
        sample.title,
        sample.url,
        sample.sourceUrl,
        sample.author,
        sample.width,
        sample.height,
      );
    }
  });
  issueSession(db, res, id, oldToken);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}
