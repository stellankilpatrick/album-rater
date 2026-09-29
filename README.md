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

### Prerequisites

- Node.js 18+
- A PostgreSQL database (local or hosted)

Local development runs both servers, each in its own terminal:

| Server | URL |
|---|---|
| Backend | http://localhost:3000 |
| Frontend | http://localhost:3001 |

### Backend

```bash
cd backend
npm install
```

Create `backend/.env.local` based on `.env.example` (it's gitignored and loaded whenever `NODE_ENV` isn't `production`). Run commands from inside `backend/` so it's found.

- `DATABASE_URL`: use a local or dev database, **not** the production one, or local testing will modify real data.
- `FRONTEND_URLS`: leave unset to allow all origins locally, or include `http://localhost:3001`.
- `APP_URL=http://localhost:3001` so password-reset links point at the local frontend.

Then initialize the database schema and start the server:

```bash
npm run initdb
npm start
```

### Frontend

```bash
cd frontend
npm install
npm start
```

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
