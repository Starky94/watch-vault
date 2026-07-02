# watch-vault

WatchVault ships with a Docker-first stack for the Vite web app, Node API, Postgres database, and scheduled TMDB importers.

## Setup

1. Copy [.env.example](/Users/florindruta/dev/watchvault/.env.example) to `.env`.
2. Set `TMDB_BEARER_TOKEN` to your TMDB v3 bearer token.
3. Keep `DATABASE_URL` pointed at `db:5432` when running through Docker Compose.
4. If you run the Node processes outside Docker, switch the host in `DATABASE_URL` to `127.0.0.1`.

## Docker

### Production-style stack

```bash
docker compose up --build
```

Services:
- Web app: `http://localhost:8080`
- API (through reverse proxy): `http://localhost:8080/api/health`
- Postgres: internal `db:5432`

The popular importer runs automatically every 10 minutes, and the Now Playing importer runs once every 24 hours. Both log each import attempt and share a TMDB client throttle capped below 40 requests per second.

Use this mode when you want the production-style static web image. Frontend changes require rebuilding the `web` image.

### Development stack

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Dev ports:
- Web app (Vite): `http://localhost:8080`
- API: `http://localhost:3001`
- Postgres: `localhost:5432`

This mode uses bind mounts plus file watching so frontend and backend changes are reflected without rebuilding the images.

Dev behavior:
- `web-dev` runs the Vite dev server with Docker-friendly file polling.
- `api` runs `node --watch` so server code reloads automatically.
- `web` is disabled in this mode unless you explicitly enable the `prod` profile.

If you previously ran the production-style stack on port `8080`, stop it before starting the dev stack so the Vite container can bind that port cleanly.

### Useful Docker commands

```bash
docker compose exec api node server/importMoviesCli.js
docker compose logs -f importer
docker compose logs -f api web-dev db
docker compose down
```

## Local Node commands

- `npm run dev` starts the Vite frontend outside Docker.
- `npm run server` starts the API outside Docker.
- `npm run server:watch` starts the API with automatic reload on file changes.
- `npm run import:movies` runs a one-off TMDB import.
- `npm run import:now-playing` runs a one-off TMDB Now Playing import for movies released in the last 30 days.
- `npm run dev:stack` starts frontend and backend together outside Docker.
- `npm test` runs the backend unit tests.

## API

- `GET /api/health` returns a basic health response.
- `GET /api/movies` returns the imported popular movies ordered by popularity plus a featured movie payload derived from the top result.
