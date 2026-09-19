FRAMEBOARD
Change++ Fall 2026 Coding Challenge

Name: Jihwan Oh
Vanderbilt Email: jihwan.oh@Vanderbilt.Edu

ABOUT THE APP

Frameboard is a place to save photos you like. You can search for photos
or upload your own. You can put them into collections, like folders for
travel ideas or favorite places. You can also share a collection and
let other people add photos to it.

TOOLS USED

- React, TypeScript, Vite, and Material UI for the website
- Node.js and Express for the server
- SQLite to save the data
- Sharp to process uploaded photos
- Pixabay for optional online photo searches

The website and the server run separately. The website uses port 5173.
The server uses port 5001. Vite sends requests from the website to the server.

HOW TO RUN IT

You need Node.js 24 or newer and npm. You also need internet access
when you install the packages.

1. Download or clone this project.
2. Open the project folder in VS Code.
3. Open a terminal in the folder that has package.json, web, and server.
4. Run these commands, one at a time:

       npm install
       npm run dev

5. Open http://localhost:5173 in your browser.

Leave the terminal open while you use the app. Press Ctrl+C to stop it.
If PowerShell blocks npm on Windows, try these commands instead:

    npm.cmd install
    npm.cmd run dev

You do not need to set up a database. The app does that for you.
You also do not need an API key to try it. Without a Pixabay key,
you can search the 16 sample photos that come with the project.

WHAT YOU CAN DO

- Create, rename, and delete collections.
- Change a collection's description and color.
- Search for photos and save them to a collection.
- Upload your own photos and see a preview before saving.
- Change a photo's title or note, or remove the photo.
- Use the app as a guest or create an account.
- Share a collection with a link.
- Choose whether people can only view it or also edit it.
- Add or remove people who can edit by using their account email.

The app keeps your collections after you restart the server.
It also stops the same search photo from being saved twice in one collection.
Shared collections check for changes every seven seconds while the tab is open
and visible. If two people edit the same photo, the app checks its version
so one person's changes do not replace newer changes without a warning.

HOW TO USE IT

Make a collection:
Click "New collection," enter a name, and click "Create collection."

Save a photo:
Search for a word like "mountains" or "ocean." Click "Save" on a photo.
Choose a collection and click "Save image."

Upload your own photo:
Click "Upload photo," then "Choose photo." Pick a photo from your computer.
Check the preview, choose a title and collection, and click "Upload & save."
You can upload one JPG, PNG, or still WebP photo at a time, up to 10 MB.
Change HEIC photos to JPG first. Photos must be 50 megapixels or smaller.
The app makes large photos smaller, up to 4096 pixels on each side.

Edit a saved photo:
Open a collection and click "Edit" on a photo. Change its title or note
and save. You can also remove the photo from this window.

Share a collection:
Click "Share." Choose "View only" or "Can edit," then copy the link.
You can test the link in another browser or a private window on the same
computer. "Link off" turns it off. Changing the link setting also makes
the old link stop working.

Add someone by email:
They need an account on the same running app first. Enter their email
in the Share window. They can then edit the collection. Turning off the
share link does not remove their access. Remove their account from the
collection if you want to stop sharing with them.

SEARCHING WITH PIXABAY

This step is optional. It lets you search more than the sample photos.

1. Get an API key from https://pixabay.com/api/docs/.
2. Copy server/.env.example and name the copy server/.env.
3. Add your key to this line:

       PIXABAY_API_KEY=your_key_here

4. Restart the app.

Keep the key private. Do not upload server/.env to GitHub.
The server keeps search results for 24 hours to avoid repeating requests.
When you save a Pixabay photo, the server downloads a copy.

WHERE YOUR DATA GOES

The database is in server/data/frameboard.sqlite.
Your uploaded photos are in server/data/uploads.
Keep the server/data folder when you update the app. Do not upload its
database or your personal photos to GitHub.

Guest access depends on a browser cookie. Create an account before clearing
your cookies if you want to keep access to your collections. Creating a new
account keeps your guest collections. Signing into an account that already
exists does not move your guest collections into that account.

Your uploaded photos follow the collection's sharing rules. The server
checks who can see or change them. When you remove an uploaded photo
from its collection, the app also deletes its saved file.

TESTING

To build the app and run all the tests, use:

    npm run check

You can also run these commands on their own:

    npm run build     Check the TypeScript code and build the website
    npm test          Run the tests
    npm start         Run the built app after npm run build

There are 12 server tests and 4 tests for actions on the website.
They check things like saving photos, signing in, sharing, and uploading.

THINGS TO KNOW

- A localhost link only works on the computer running the app.
  To share across computers, the website and server need to be hosted online.
- The app does not check email ownership or let users reset passwords yet.
- Website tests use jsdom. They check actions, not how the page looks.
- Pixabay tests use sample responses. A real Pixabay key was not used
  to test live searches during development.

REFLECTION (DRAFT - CHECK BEFORE SUBMITTING)

This project helped me see how a website, a server, and a database work
together. I learned why a database is useful: it keeps saved photos and
collections after the server stops. Sharing also made me think about
who should be able to change a collection. For photo uploads, I learned
why checking file types and sizes matters. If I keep working on this
app, I would add a way to reset passwords.

CREDITS

OpenAI Codex helped with this project.
The sample photos come from Lorem Picsum and Unsplash.
The photographers and original links are in docs/PHOTO_CREDITS.txt.
Online photo search uses Pixabay when an API key is added.
