# Frameboard REST API

Local API: `http://localhost:5001/api`. The frontend uses the Vite proxy at
`http://localhost:5173/api`. Payloads are JSON. Successful DELETE responses are
204 with no body. Errors return `{ "error": "A readable message" }`.

Call `GET /auth/session` first. It resumes a cookie session or creates an
isolated guest workspace. Preserve the HttpOnly cookie on later requests.
All write requests require `X-Frameboard: 1`. Browser writes must come from
`WEB_ORIGIN` (default `http://localhost:5173`). No permissive CORS is enabled.

| Method | Endpoint                      | Request / behavior                               |
| ------ | ----------------------------- | ------------------------------------------------ |
| GET    | `/health`                     | Returns `{ok: true}` without a session           |
| GET    | `/hello`                      | Workshop compatibility endpoint                  |
| GET    | `/auth/session`               | Returns `{user}`; creates guest if needed        |
| POST   | `/auth/register`              | `{name,email,password}`; upgrades current guest  |
| POST   | `/auth/login`                 | `{email,password}`; rotates session cookie       |
| POST   | `/auth/logout`                | Signs out and opens a new guest workspace        |
| GET    | `/images?q=mountains&page=1`  | `{images,total,page,provider}`                   |
| GET    | `/boards`                     | `{boards}` owned by or invited to the account    |
| POST   | `/boards`                     | `{name,description?,color?}`; returns new board  |
| GET    | `/boards/:id`                 | Board metadata, role, revision, covers, and pins |
| PATCH  | `/boards/:id`                 | Owner: `{name,description?,color?}`              |
| DELETE | `/boards/:id`                 | Owner: delete collection and its pin records     |
| PUT    | `/boards/:id/share`           | Owner: `{mode:"private"\|"view"\|"edit"}`        |
| GET    | `/boards/shared/:token`       | Open valid share link; returns board and role    |
| GET    | `/boards/:id/members`         | Owner: `{members}`                               |
| POST   | `/boards/:id/members`         | Owner: `{email}` of a registered account         |
| DELETE | `/boards/:id/members/:userId` | Owner: remove invited account access             |
| POST   | `/boards/:id/pins`            | Editor/owner: `{imageId}` from search results    |
| PATCH  | `/boards/:id/pins/:pinId`     | Editor/owner: `{title,note,version}`             |
| DELETE | `/boards/:id/pins/:pinId`     | Editor/owner: remove pin                         |

For link-based access to `/boards/:id` and its pin endpoints, send the token
in `X-Share-Token`. Merely knowing a collection UUID grants no access.
View links cannot write. Editors cannot delete/rename collections, manage
members, or change sharing. Owners can do all of these. Registered account
membership is independent of link access and can be revoked separately.

Saving uses `imageId`, never a client-supplied image URL. Duplicate saves return
200 with `alreadySaved: true`; new saves return 201. Pixabay files are stored
under `/media` only after validating provider host, type, and size.

Pin edits require the current integer version from a GET response. If the
version changed, the server returns 409, preserving the newer edit. The UI
asks the user to reopen the image. Collection `revision` changes when content
changes, enabling periodic refresh and update notifications.

Selected errors: 400 invalid input, 401 no session / wrong login, 403 forbidden,
404 missing or inaccessible resource, 409 duplicate account or edit conflict,
413 oversized request/image, 429 rate limit, 502 upstream image search failure.

The schema, foreign keys, unique constraints, and indexes are in `server/db.js`.
API tests create their own in-memory database and do not modify the real app data.

## Personal photo uploads

`POST /boards/:id/uploads?title=My%20photo` accepts the raw file bytes
(Content-Type: image/jpeg, image/png, image/webp, or application/octet-stream),
not JSON or multipart. It requires the session cookie, X-Frameboard: 1, and
owner/editor access. For link editors, also pass X-Share-Token.
The limit is 10 MB, 50 megapixels, and a single still frame. Successful uploads
return 201 and `{pin}`. Actual pixels are decoded and re-encoded to WebP with
orientation correction and no original metadata. Maximum stored side: 4096 px.

`GET /boards/:id/uploads/:imageId` serves a saved upload only after checking
collection permissions. Pin URLs from a shared collection include the link's
`share` query parameter because normal img elements cannot set custom headers.
The endpoint uses private, no-store caching. Revoked tokens stop working.
The uploader cannot bypass ownership merely by guessing a file URL.

Uploaded images have an empty sourceUrl; the UI labels them as uploads instead
of displaying an external source link. Deleting the pin or collection deletes
its corresponding file in server/data/uploads. Existing databases need no
schema migration for this feature.
