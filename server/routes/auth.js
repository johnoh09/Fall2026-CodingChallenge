import { Router } from 'express';
import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { createGuest, issueSession, publicUser, requireUser } from '../middleware/session.js';
import { HttpError } from '../middleware/errors.js';

const scrypt = promisify(scryptCallback);
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8, 'Use at least 8 characters for your password.').max(128),
});
const signup = credentials.extend({ name: z.string().trim().min(1, 'Enter your name.').max(60) });
async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
export function authRoutes(db) {
  const router = Router();
  router.get('/session', (req, res) =>
    res.json({ user: publicUser(req.user || createGuest(db, res)) }),
  );
  router.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many attempts. Please try again in 15 minutes.' },
    }),
  );
  router.post('/register', requireUser, async (req, res) => {
    const data = signup.parse(req.body);
    if (req.user.email) throw new HttpError(400, 'You already have an account.');
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(data.email))
      throw new HttpError(409, 'This email already has an account. Sign in instead.');
    const password = await passwordHash(data.password);
    try {
      db.prepare(
        'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ? AND email IS NULL',
      ).run(data.name, data.email, password, req.user.id);
    } catch (error) {
      if (String(error.message).includes('UNIQUE'))
        throw new HttpError(409, 'This email already has an account.');
      throw error;
    }
    issueSession(db, res, req.user.id, req.cookies.frameboard_session);
    res
      .status(201)
      .json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
  });
  router.post('/login', async (req, res) => {
    const { email, password } = credentials.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const stored = user?.password || `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const candidate = await passwordHash(password, stored.split(':')[0]);
    if (
      !timingSafeEqual(
        Buffer.from(candidate.split(':')[1], 'hex'),
        Buffer.from(stored.split(':')[1], 'hex'),
      ) ||
      !user
    )
      throw new HttpError(401, 'Email or password is incorrect.');
    issueSession(db, res, user.id, req.cookies.frameboard_session);
    res.json({ user: publicUser(user) });
  });
  router.post('/logout', requireUser, (req, res) => {
    // Rotate to a fresh guest session; the registered account's boards stay in SQLite.
    const guest = createGuest(db, res, req.cookies.frameboard_session);
    res.json({ user: publicUser(guest) });
  });
  return router;
}
