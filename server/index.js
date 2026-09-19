import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { openDatabase, serverDir } from './db.js';
import { createApp } from './app.js';

dotenv.config({ path: resolve(serverDir, '.env'), quiet: true });
const db = openDatabase(process.env.DATABASE_PATH);
const app = createApp(db);
const port = Number(process.env.PORT || 5001);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`Frameboard API: http://localhost:${port}`),
);
function close() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
