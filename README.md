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
- JWT-based authentication with bcrypt password hashing

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

### Backend

```bash
cd backend
npm install
```

Create a `.env.local` (for development) or `.env` (for production) file based on `.env.example`:

```
JWT_SECRET=
JWT_EXPIRES_IN=7d
DATABASE_URL=
PORT=3000
```

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

The frontend expects the backend's base URL to be configured in `src/api/api.js`.

## Environment Variables

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret used to sign authentication tokens |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Port the backend server listens on (defaults to `3000`) |

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
