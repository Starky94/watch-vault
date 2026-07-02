# watch-vault

WatchVault ships with a Docker-first stack for the Vite web app, Node API, Postgres database, and a scheduled TMDB importer.

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

The importer runs automatically every 10 minutes and logs each import attempt.

### Development stack

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Dev ports:
- Web app (Vite): `http://localhost:4173`
- API: `http://localhost:3001`
- Postgres: `localhost:5432`

This mode uses bind mounts for the repo so frontend and backend changes are reflected without rebuilding the images.

### Useful Docker commands

```bash
docker compose exec api node server/importMoviesCli.js
docker compose logs -f importer
docker compose logs -f api web db
docker compose down
```

## Local Node commands

- `npm run dev` starts the Vite frontend outside Docker.
- `npm run server` starts the API outside Docker.
- `npm run import:movies` runs a one-off TMDB import.
- `npm run dev:stack` starts frontend and backend together outside Docker.
- `npm test` runs the backend unit tests.

## API

- `GET /api/health` returns a basic health response.
- `GET /api/movies` returns the imported movies ordered by import rank.
