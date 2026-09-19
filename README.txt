FRAMEBOARD — Change++ Fall 2026 Coding Challenge
==============================================

Full name: Jihwan Oh
Vanderbilt email: [REPLACE WITH YOUR VANDERBILT EMAIL BEFORE SUBMITTING]

Frameboard is an image discovery and collection app. Users can search for
images, organize collections, edit image titles and notes, and collaborate
through share links or registered accounts.

QUICK START
-----------
Prerequisite: Node.js 24 or newer (includes npm).
Download Node.js from https://nodejs.org/ if needed.

1. Open this folder in VS Code. The root contains package.json, web, and server.
2. In a terminal in this folder, run:

   npm install
   npm run dev

3. Open http://localhost:5173 in your browser.
4. Keep the terminal open. Press Ctrl+C to stop both servers.

On Windows PowerShell, if npm.ps1 is blocked, use npm.cmd instead:
   npm.cmd install
   npm.cmd run dev
Alternatively select Command Prompt as the VS Code terminal profile.

The root uses npm workspaces. Run npm install once at the root; there is no
need to install dependencies separately in web and server. For a clean
reproducible install with the supplied package-lock.json, use npm ci.

The frontend is Vite + React + TypeScript + Material UI on port 5173.
The backend is a separate Express server on port 5001, matching the workshop.
The frontend calls /api through Vite's proxy. The workshop's /api/hello endpoint
remains available at http://localhost:5001/api/hello.
Backend source uses ES modules (import); server/package.json sets type: module.

BUILD AND TEST
--------------
   npm run build      Type-check and build the frontend
   npm test           Run backend integration tests and frontend interaction tests
   npm run check      Run both build and tests
   npm start          Run the API and built frontend (run npm run build first)

npm start is a local production-build preview, not a hardened public hosting
configuration. Both development and preview use frontend 5173 / API 5001.

Alternatively use two terminals after installing from the root:
   Terminal 1: cd server  then  npm run dev
   Terminal 2: cd web     then  npm run dev

PERSONAL PHOTO UPLOADS
----------------------
Select Upload photo in the top bar or inside a collection. Choose a local JPG,
PNG, or still WebP file (up to 10 MB and 50 megapixels), review the preview/title,
choose a collection, and select Upload & save. Convert HEIC to JPG first.
No Pixabay key is needed. Upload one photo at a time.
Uploaded photos can be edited and removed like saved search results.
The server validates and re-encodes pixels, corrects orientation, removes image
metadata, and scales very large photos to fit within 4096 x 4096 pixels.
Uploads are stored in server/data/uploads, outside the public media directory.
Reading an uploaded photo requires collection access; shared image URLs become
invalid when that share link is revoked. Deleting the pin/collection removes
its uploaded image files. These files are not served from a public static path.

UPDATING AN EXISTING INSTALLATION
--------------------------------
Stop the server. Back up your project first. Merge the new ZIP's project files
into your current project, preserving server/data, server/.env, and .git.
Do not delete your existing server folder or database. Run npm install again
(the upload feature adds sharp), then npm run dev. No database reset is needed.

FEATURES
--------
- Personal photo uploads with preview, collection selection, and protected file access.
- Searchable, credited sample library (16 bundled photos; no API key required).
- Optional live Pixabay image search, with server-side key and 24-hour cache.
- Collections with names, descriptions, and colors; collection edit/delete.
- Save photos, edit titles and notes, remove photos, and prevent duplicate saves.
- SQLite persistence: collections, images, users, permissions, and sessions.
- Guest workspaces isolated by an HttpOnly session cookie.
- Create an account to preserve the current guest workspace and sign in elsewhere.
- Password hashing with salted scrypt; session tokens stored as hashes.
- View-only or collaborative share links; switching access rotates the link.
- Add/remove registered account collaborators by email.
- Shared collection refresh every 7 seconds while the tab is visible.
- Version checks prevent one collaborator from silently overwriting a newer pin edit.
- Responsive layout, lazy-loaded photos, input validation, loading/error/empty states,
  confirmation before removal, and original-photo attribution links.

TRY THE APP
-----------
1. Open Discover. Search "mountains", "ocean", "forest", or "design".
2. Select New collection. Give it a name.
3. Select Add images, then Save on a photo. Choose your collection.
4. Select Done adding. Open an image or select Edit to change its title/note.
5. Use Share > View only or Can edit. Copy the generated link.
6. Open it in another browser/incognito window on the same computer. A view
   link cannot edit; an edit link can add, edit, and remove photos.
7. Switch to Link off to revoke link access. Invited accounts retain their
   access until removed individually.
8. Create an account from the sidebar. To test account collaboration, create
   another account in another browser and invite its email via Share.
9. Refresh or stop/restart the server: the SQLite database retains your data.

Guest identity is tied to a browser cookie with a 30-day session lifetime.
The data is stored on the server, not in localStorage. Clearing cookies loses
access to a guest workspace; create an account first if you want to keep it.
Signing into an existing account does not merge the guest workspace.

LIVE PIXABAY SEARCH (OPTIONAL)
-----------------------------
1. Create a Pixabay account and obtain your key: https://pixabay.com/api/docs/
2. Copy server/.env.example to server/.env.
3. Set PIXABAY_API_KEY=your_actual_key in server/.env.
4. Restart npm run dev.

Without a key, search filters the included sample titles, tags, and authors.
The UI explicitly labels this mode as Sample library. It is not live web search.
With a key, the backend fetches Pixabay results. It caches queries for 24 hours,
credits Pixabay, and downloads a photo to server/data/media when it is saved
instead of permanently hotlinking provider URLs. Search results use temporary
provider thumbnails. Requests have timeouts, a 10 MB image limit, and a provider
host allowlist. The key never goes to the frontend and .env is gitignored.

STORAGE AND SHARING
-------------------
SQLite is built into Node.js 24, so no database account, database server, or
native package compiler is required. Tables and indexes initialize on launch.
The database is server/data/frameboard.sqlite. It and downloaded photos are
excluded from Git. Back up server/data to preserve an installation's content.

Share links use the frontend's current origin. A localhost link works only
on the same computer. To collaborate across computers, host both services at
reachable addresses, proxy /api and /media to the API, preserve server/data,
set WEB_ORIGIN to the actual frontend origin, and set COOKIE_SECURE=true for
HTTPS. Deployment is not included in this download. Vite is a development tool;
use a suitable static frontend host/reverse proxy for a public deployment.

Link off means there is no anonymous share link. It is not a public directory.
View links grant viewing to anyone holding that link; edit links grant editing.
Share only the intended link. Individual account invitations are independent.

PROJECT MAP
-----------
package.json                 One-command setup, development, and checks
web/src/App.tsx              Page state, navigation, search, and collections
web/src/App.css              Responsive visual design
web/src/components/          Photo/collection cards and dialogs
web/src/api.ts               Typed HTTP helper and error handling
web/src/types.ts             Shared frontend data shapes
web/src/App.test.tsx         UI interactions against a real test API and SQLite
web/vite.config.ts           Separate frontend server and API proxy
web/public/samples/          Bundled sample photos
server/index.js              Server startup; port 5001
server/app.js                Express middleware and route registration
server/db.js                 SQLite schema, transactions, and helper functions
server/routes/auth.js        Guest session, account registration, login/logout
server/routes/boards.js      Collections, photos, permissions, and collaboration
server/services/images.js    Sample search, Pixabay cache, and image downloads
server/services/uploads.js   Validation, re-encoding, and storage of personal photos
server/middleware/           Session checks, validation/error responses
server/tests/app.test.js     Backend integration/security/persistence tests
docs/API.md                  REST endpoint reference
docs/PHOTO_CREDITS.txt        Sample photographers and original source pages
docs/CODE_WALKTHROUGH_KO.md   Korean explanation of how the code works
START_HERE_KO.txt            Korean setup and submission instructions

VALIDATION AND LIMITATIONS
--------------------------
- Automated backend and frontend interaction tests are included.
- Frontend interaction tests use jsdom and a real Express/SQLite test instance;
  they do not verify pixel layout in a real browser.
- A real-browser localhost preview was blocked in the authoring environment.
  Visually review desktop and phone-sized layouts on your computer.
- Pixabay was tested with a mocked provider. Live integration requires your
  own API key and was not tested with a real key in the authoring environment.
- Account emails are not verified, and password reset is not implemented.
- Updates use polling, not WebSockets; pin edits are version checked, while
  collection metadata edits use the latest submitted value.
- This is a challenge-sized single-server app, not a production service with
  backups, email delivery, monitoring, or multi-instance database support.
- No GitHub fork, push, public deployment, or completion-form submission has
  been performed by this source package.

REFLECTION — DRAFT TO REVIEW AND PERSONALIZE (under 100 words)
-------------------------------------------------------------
Building Frameboard helped me connect a React interface to a separate Express
API. I practiced organizing code into components, routes, and database helpers.
Sharing collections made permissions important: a viewer should not be able to
edit, and an old link should stop working after access changes. I also learned
why data should stay in a database after the server restarts. If I continued
this project, I would improve account recovery and replace polling with
real-time updates.

This paragraph is a suggested draft. Replace or revise it to reflect your own
experience after reviewing, running, and modifying the project.

FEEDBACK
--------
Optional: replace this line with any feedback you want to give the organizers.

ACKNOWLEDGMENTS
--------------
Implementation prepared with help from OpenAI Codex. Review the code and be
ready to explain the architecture and the parts you modify.
Workshop base: React/TypeScript in web, Express in server, API port 5001.
Assignment: https://github.com/ChangePlusPlusVandy/Fall2026-CodingChallenge
Photos: Lorem Picsum / Unsplash; full credits are in docs/PHOTO_CREDITS.txt.
Optional image service: Pixabay (https://pixabay.com/api/docs/).

SUBMISSION CHECKLIST
--------------------
[ ] Replace the Vanderbilt email placeholder and confirm your full name.
[ ] Review and personalize the reflection above (under 100 words).
[ ] Run npm run check and try the app in your browser.
[ ] Copy this project's files into your own fork of the challenge repository.
[ ] Keep the assignment's original README.md; include this README.txt as well.
[ ] Commit and push source, package-lock.json, tests, and sample assets.
[ ] Do not commit node_modules, server/.env, web/dist, or server/data contents.
[ ] Submit your fork URL at https://forms.gle/JfR4cwAEwn4HhBuX8
Deadline from the assignment: September 18, 2026, 11:59 PM Central Time.
