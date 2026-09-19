import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError)
    return res.status(400).json({ error: error.issues[0]?.message || 'Invalid input.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (error.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request is too large.' });
  const status = error.status || 500;
  if (status >= 500) console.error(error.message);
  res.status(status).json({
    error:
      status >= 500 && !(error instanceof HttpError)
        ? 'The server could not complete that request. Please try again.'
        : error.message,
  });
}
