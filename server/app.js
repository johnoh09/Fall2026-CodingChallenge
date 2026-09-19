import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { authRoutes } from './routes/auth.js';
import { boardRoutes } from './routes/boards.js';
import { sessionMiddleware, requireUser } from './middleware/session.js';
import { errorHandler, HttpError } from './middleware/errors.js';
import { createImageService } from './services/images.js';

export function createApp(db, options = {}) {
  const app = express(),
    images = createImageService(db, options);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many requests. Please wait a minute.' },
    }),
  );
  // Vite forwards same-origin API requests. JSON + a custom header prevent cross-site writes.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('X-Frameboard') !== '1')
        throw new HttpError(403, 'Missing request verification header.');
      const origin = req.get('Origin');
      if (origin && origin !== (process.env.WEB_ORIGIN || 'http://localhost:5173'))
        throw new HttpError(403, 'This origin is not allowed.');
    }
    next();
  });
  app.get('/api/hello', (req, res) => res.json({ message: 'Hello from Frameboard!' }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', sessionMiddleware(db));
  app.use('/api/auth', authRoutes(db));
  app.use('/api', requireUser);
  app.get('/api/images', async (req, res) => {
    const { q, page } = z
      .object({
        q: z.string().trim().max(100).default(''),
        page: z.coerce.number().int().min(1).max(21).default(1),
      })
      .parse(req.query);
    res.json(await images.search(q, page));
  });
  app.use('/api/boards', boardRoutes(db, images, options));
  app.use('/media', express.static(images.mediaDir, { maxAge: '7d', dotfiles: 'deny' }));
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use(errorHandler);
  return app;
}
