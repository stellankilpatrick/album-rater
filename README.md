# Album Rater

Rate albums. Track your taste. Discover what others love.

Album Rater is a full-stack social platform for rating music at the song level and rolling those ratings up into album scores, personal rankings, and a social feed of what your friends are listening to.

## Features

**Rating & Rankings**
- Rate individual songs on a three-state scale (Good / Mid / Bad)
- Album scores are computed automatically from song ratings, weighting how much of the album you actually rate and factoring in skips
- Personal rankings by album and by artist, plus rank breakdowns by genre, release year, decade, and within an artist's discography
- Add new albums, artists, and tracklists yourself

**Social**
- Follow other users and see their activity in a community feed
- Recommend albums directly to other users, with notifications when they rate what you sent them
- Leave comments/reviews on albums, like other users' ratings, and see what mutual follows think of an album
- Notifications for recommendations, likes, and replies

**Discovery**
- Browse and search albums, artists, and users
- "Released This Week in History" surfaces anniversary albums worth revisiting
- Maintain a Listen List of albums you want to get to

**Profiles**
- Customizable profile picture, banner, and bio
- Public profile pages showing top albums, top artists, follower/following counts, and rating totals

## Tech Stack

**Frontend**
- React 18 (Create React App) with React Router
- Axios for API calls
- Plain CSS (no UI framework), dark theme throughout

**Backend**
- Node.js + Express
- PostgreSQL via `pg`

## Project Structure

```
albumRater/
├── backend/
│   ├── auth/            # registration, login, JWT middleware
│   ├── db/               # database connection pool
│   ├── models/           # query logic per resource
│   ├── routes/           # Express route handlers
│   ├── initPostgres.js   # creates tables/indexes on a fresh database
│   └── index.js          # app entrypoint
└── frontend/
    └── src/
        ├── api/           # axios client
        └── components/    # pages and UI components
```

## Getting Started

Local development uses your own Postgres database, so nothing you do locally touches production data.

| Server | URL |
|---|---|
| Backend | http://localhost:3000 |
| Frontend | http://localhost:3001 |

### One-time setup

1. **Install Node.js 18+ and PostgreSQL.**
   - macOS: `brew install postgresql@18 && brew services start postgresql@18`
   - Windows: install PostgreSQL from https://www.postgresql.org/download/windows/ and note the password you set for the `postgres` user.

2. **Create a local database** named `album_rater_dev`.
   - macOS: `createdb album_rater_dev`
   - Windows: `createdb -U postgres album_rater_dev` (or create it in pgAdmin)

3. **Install dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

4. **Create `backend/.env.local`** (gitignored) by copying `backend/.env.example`, then set:
   ```
   # macOS
   DATABASE_URL=postgres://localhost:5432/album_rater_dev
   # Windows (use the password from step 1)
   DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/album_rater_dev

   JWT_SECRET=any-long-random-string
   APP_URL=http://localhost:3001
   ```
   The SMTP settings can stay as placeholders; password-reset emails just won't send locally.
   **Never** put the production (Neon) database URL here.

5. **Create the tables:**
   ```bash
   cd backend && npm run initdb
   ```
   This is safe to re-run, and it refuses to run against a non-local database.

### Every time you work on the app

Run both servers, each in its own terminal:

```bash
cd backend && npm start     # http://localhost:3000
cd frontend && npm start    # http://localhost:3001, opens in your browser
```

Your local database starts empty, so sign up for a new account locally; production accounts don't exist here.

### How the frontend finds the backend

The backend URL comes from `REACT_APP_API_URL`, which is baked into the bundle when the dev server starts or the app is built:

| File | Used by | Points at |
|---|---|---|
| `frontend/.env.development` | `npm start` | local backend (`http://localhost:3000`) |
| `frontend/.env.production` | `npm run build` | deployed backend on Render |

Restart `npm start` after changing any `.env` file.

To point your own frontend somewhere else (e.g. the deployed backend) without affecting anyone else, create `frontend/.env.development.local` (gitignored) and set `REACT_APP_API_URL` there. Pointing at the deployed backend means reading and writing **production data**.

If you get unexpected 401s locally, log out and back in; a token issued by a different backend (different `JWT_SECRET`) won't verify.

Never put secrets in `REACT_APP_*` variables; they end up in the public JS bundle.

## Deployment

- **Frontend (Vercel):** builds `frontend/` with `npm run build`, which reads `.env.production`. A `REACT_APP_API_URL` set in the Vercel dashboard overrides it.
- **Backend (Render):** runs `npm start` in `backend/`, with secrets (`DATABASE_URL`, `JWT_SECRET`, SMTP) and `FRONTEND_URLS` set in the Render dashboard, never in the repo.
- **Database (Neon):** production Postgres. Schema changes there are made by hand; if you add a table or column, add it to `backend/initPostgres.js` too so local databases stay in sync.

## Making changes

`main` is protected: changes go in through a pull request with one approval, and merging to `main` deploys.

1. `git switch main && git pull`
2. `git switch -c my-change`
3. Make and test the change locally (both servers running, see above).
4. `git add -A && git commit -m "..."` then `git push -u origin my-change`
5. Open a pull request into `main` on GitHub; the other contributor reviews and approves it.
6. Merge. Vercel and Render redeploy automatically.

If the change needs a new database column or table, apply it to the Neon database before (or right as) the code is merged, and add it to `initPostgres.js`.

## API Overview

All authenticated routes expect a `Bearer` token from `/auth/login` or `/auth/register`.

| Base path | Covers |
|---|---|
| `/auth` | Registration, login, current-user lookup |
| `/albums` | Album CRUD, ratings, rankings, comments, genres |
| `/artists` | Artist CRUD and per-user rankings |
| `/songs` | Song ratings, titles, ordering |
| `/users` | Profiles, follows, listen list, top albums/artists |
| `/community` | Activity feed, recommendations |
| `/likes` | Liking ratings/reviews |
| `/notifications` | In-app notifications |
| `/search` | Cross-entity search (albums, artists, users) |
