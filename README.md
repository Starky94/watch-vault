# watch-vault

WatchVault ships with a Docker-first stack for the Vite web app, Node API, Postgres database, and scheduled TMDB importers.

## Setup

1. Copy [.env.example](/Users/florindruta/dev/watchvault/.env.example) to `.env`.
2. Set `TMDB_BEARER_TOKEN` to your TMDB v3 bearer token and `GOOGLE_BOOKS_API_KEY` to an API key with Google Books API access.
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

The popular movie and TV importers run automatically every 10 minutes; Now Playing, Upcoming, popular games, recently released games, and upcoming games run every 24 hours; and the Google Books and news RSS importers run hourly. The seasonal-theme scheduler evaluates immediately on startup and then daily at 00:05 in `THEME_SCHEDULER_TIME_ZONE` (default: `Europe/Bucharest`). The news-retention cleanup runs daily at 00:10 in `NEWS_CLEANUP_TIME_ZONE` (default: `Europe/Bucharest`), deleting only articles published more than seven days ago that no user has saved and that have no actor, movie, or show mapping. Configure the IGDB Client ID and Client Secret in Admin before the games importers can run.

Use this mode when you want the production-style static web image. Frontend changes require rebuilding the `web` image.

### Second isolated production stack

To run a second independent deployment on a different port, use a distinct Compose project name plus a dedicated env file.

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -p watchvault-8181 up --build -d
```

Recommended production values in `.env.production`:
- `APP_ENV_FILE=.env.production`
- `WEB_PORT=8181`
- `DATABASE_URL=postgresql://postgres:postgres@db:5432/watchvault`
- a real `TMDB_BEARER_TOKEN`

Isolation notes:
- Use a unique Compose project name such as `watchvault-8181`.
- Keep a dedicated env file for the second stack.
- The unique project name gives the stack its own containers, network, and Postgres volume.
- The dedicated `WEB_PORT` prevents collision with the existing `:8080` deployment.

### Auto deploy for `:8181`

This repo includes a deployment script that is intentionally locked to the WatchVault `:8181` production target on `46.101.143.222`.

```bash
npm run deploy:prod-8181
```

What it does:
- verifies the repo is `watchvault`
- uploads the current codebase to `/var/www/watchvault-8181`
- refuses to continue unless the remote `.env.production` is still configured for `WEB_PORT=8181`
- runs `docker compose --env-file .env.production -p watchvault-8181 up -d --build`
- verifies `http://127.0.0.1:8181/api/health` on the server

This script is intentionally not reusable for other repositories, hosts, directories, or ports.

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
- `news-cleanup` starts automatically and waits for its next daily 00:10 run.
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
- `npm run import:books` imports 10 Google Books titles from one randomly selected subject each run.
- `npm run import:entertainment-news` imports articles hourly from BBC Sport Formula 1 and IGN PS5, Movies, and TV RSS feeds. Each article keeps its source category; exact RSS category matches still link actors, movies, and shows.
- `npm run import:now-playing` runs a one-off TMDB Now Playing import for movies released in the last 30 days.
- `npm run import:upcoming` runs a one-off TMDB Upcoming import for movies releasing in the next 30 days.
- `npm run import:tv-popular` runs a one-off TMDB Popular TV import.
- `npm run import:tv-airing-today` runs a one-off TMDB Airing Today TV import for shows first aired in the last 30 days.
- `npm run import:tv-on-the-air` runs a one-off TMDB On The Air TV import for shows first airing in the next 30 days.
- `npm run import:games` imports 30 popular games from IGDB, ranked by Steam 24-hour peak players.
- `npm run import:games-recently-released` imports up to 30 games released in the last 30 days, ranked by IGDB Visits.
- `npm run import:games-upcoming` imports up to 30 games releasing in the next 30 days, sorted by release date then IGDB Visits.
- `npm run schedule:themes` starts the daily seasonal-theme scheduler worker; `npm run schedule:themes:once` evaluates and persists the theme once.
- `npm run dev:stack` starts frontend and backend together outside Docker.
- `npm test` runs the backend unit tests.

TV watchlist completion integration tests also run when `WATCHVAULT_TEST_DATABASE_URL` points to a disposable PostgreSQL database. Run `WATCHVAULT_TEST_DATABASE_URL=postgresql://... node --test server/__tests__/tvWatchlistCompletion.integration.test.js`; the test creates and drops its own isolated schema.

## Trending videos

The homepage's **Trending Videos** carousel serves twelve cached movie/TV videos from
`GET /api/videos/trending`. **See all** expands up to sixty cached results in place
(`?limit=60`). Both views use the existing movie/TV detail navigation and watchlist
actions. Playback uses the shared privacy-enhanced YouTube dialog, with a direct
YouTube link and fallback for blocked, unavailable, or non-embeddable videos.

Set the server-only `YOUTUBE_API_KEY` to a key with YouTube Data API v3 enabled.
The existing `TMDB_BEARER_TOKEN` supplies exact movie/TV video associations.
Never prefix either credential with `VITE_`. No YouTube requests are made during
homepage reads, and credentials are never sent to the browser.

Run `npm run sync:trending-videos` for one synchronization or
`npm run schedule:trending-videos` for the worker. Docker Compose includes the
`trending-videos` service; `npm run dev:stack` also starts the worker. It runs on
startup and two hours after each completed synchronization. Without a YouTube key,
the worker remains idle and the homepage displays its empty state.

Configuration (also documented in `.env.example`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `TRENDING_VIDEO_REGIONS` | `US,GB,CA,AU,DE,FR,BR,IN,JP,KR` | Regional Film & Animation charts to merge |
| `TRENDING_VIDEO_CHANNEL_HANDLES` | Eight studio/streamer handles in `.env.example` | Trusted official channels; use an empty value to disable |
| `TRENDING_VIDEO_SYNC_MINUTES` | `120` | Delay between completed runs, minimum 15 minutes |
| `TRENDING_VIDEO_SEARCHES_PER_SYNC` | `2` | Rotating recent searches per run, maximum 7 |
| `TRENDING_VIDEO_DAILY_SEARCH_CALLS` | `24` | Persisted daily search-call budget, zero disables search |
| `TRENDING_VIDEO_DAILY_QUOTA_UNITS` | `8000` | Conservative daily quota allocation for this feature |

Discovery merges each region's chart, recent searches, one recent upload-playlist
page per official channel, and videos for trending movies/TV and upcoming movies
from TMDB. Only API-resolved channel IDs and upload-playlist IDs are persisted;
no IDs are guessed. Handle ownership is refreshed every 28 days. Configure only
handles you have verified as official. Search results and chart category alone do
not establish relevance: each accepted video must come from a trusted channel or
match an exact TMDB YouTube ID. English title filters reject common gaming, music,
reaction, and fan/concept-trailer patterns; these heuristics are intentionally
conservative and may miss legitimate content in other languages.

The score combines logarithmic views per hour, total views, publication recency,
multi-region presence, trusted-channel evidence, and TMDB's official flag. After
two comparable snapshots, measured view growth replaces lifetime-average velocity.
Older videos need current regional-chart presence or observed renewed engagement.
The output prefers no more than two videos per channel/title and four single-region
videos per region, relaxing preferences when needed to fill available slots. Exact
IDs and normalized duplicate promotional titles are deduplicated. This is a
**custom global trending approximation**, not an official global YouTube ranking.
Fewer than twelve results are shown when insufficient legitimate videos qualify.

PostgreSQL stores an atomic ranked snapshot, channel resolutions, and daily quota
reservations. An advisory lock prevents concurrent workers/manual runs. Quotas
reset on the Pacific calendar day, survive restarts, and conservatively account
for each search as 100 units as well as one search call. Leave room for other
features/projects using the same key; the budget only accounts for this worker.
Failed source requests are isolated; an incomplete statistics refresh preserves
the previous snapshot. Videos missing from a successful details response are
removed. The UI labels delayed updates after six hours and stops serving metadata
unrefreshed for thirty days. Worker failures use the existing error log.

`node --test server/__tests__/trendingVideos.test.js` verifies classification,
ranking/diversity, stale-cache handling, deleted videos, quota reservations,
channel resolution, exact TMDB association, failure recovery, and the public API.

The Games overview includes a separate **Trending Videos** rail before Popular
Right Now, with official game trailers and teasers (including gameplay trailers).
It uses `/api/games/videos/trending` with the same 12/60 limits and player as the
homepage. No catalog match or IGDB credentials are required. Videos have no game
association or favorite controls.

The existing `schedule:trending-videos` worker and `sync:trending-videos` command
refresh both feeds independently, using separate caches and synchronization locks.
Both share `YOUTUBE_API_KEY`, `TRENDING_VIDEO_REGIONS`, the refresh interval, and
the existing daily quota ledger/budget. Set `TRENDING_GAME_VIDEO_CHANNEL_HANDLES`
to customize official gaming sources (PlayStation, Xbox, Nintendo America,
Ubisoft, and EA by default). Handles are resolved through YouTube; unresolved
channels are skipped. Game discovery combines recent official uploads with
regional Gaming charts and makes no search calls. Only trailers/teasers from
configured channels qualify; standalone gameplay, walkthroughs, reactions,
fan/concept trailers, livestreams, and unrelated promotions are excluded.
Ranking, stale-cache behavior, and thirty-day metadata expiry match the homepage.
Without a YouTube key, the worker stays idle and an unpopulated feed shows an
empty state. No additional Docker service is needed.

## Version management

- Use Node.js 24.15.0 or newer within Node 24, with npm 12.2.0. For local setup, run `nvm install`, `nvm use`, then `npm install --global npm@12.2.0`. The `.nvmrc` file pins the local Node version; `package.json` records the Node and npm requirements. CI and Docker builds install npm 12.2.0 before installing dependencies.
- GitHub Dependabot checks npm dependencies, Docker images, and GitHub Actions weekly and opens pull requests for updates. Patch and minor npm updates are grouped; major updates stay separate for review.
- Review each update pull request, then merge it after the CI checks pass. `package-lock.json` pins the exact npm dependency tree used by `npm ci`.
- For a manual check, run `npm outdated` for direct dependencies or `npm outdated --all` for the full dependency tree. TypeScript is not currently used by this JavaScript project.

## API

- `GET /api/health` returns a basic health response.
- `PUT /api/tv/:showId/watching-status` accepts `{ "stoppedWatching": true }` or `false` for the signed-in user. Stopping a started, unfinished show removes it from the watchlist and Continue Watching while preserving episode history and ratings. Resuming, adding it to the watchlist, or marking episodes watched resumes it; completed ended shows stay off the watchlist.
- `GET /api/movies` returns the imported popular movies ordered by popularity plus a featured movie payload derived from the top result.
- `GET /api/books` returns imported books from the local database.
- `GET /api/books/:bookId` returns a stored book's full metadata.
- `GET /api/movies/recently-released` returns recently released movies from the local DB.
- `GET /api/movies/upcoming` returns upcoming movies releasing in the next 30 days from the local DB.
- `GET /api/games/upcoming` returns upcoming games releasing in the next 30 days from the local DB.

### Movie collections

The `importer-collections` worker imports new TMDB collections daily at **08:30 UTC**. It waits for the next scheduled run after startup, so restarting Docker does not immediately resume an interrupted import. Set `COLLECTIONS_IMPORT_ON_STARTUP=true` to additionally import immediately at worker startup. The container uses `restart: unless-stopped` to resume scheduling when Docker restarts. It downloads the latest expected available `collection_ids_MM_DD_YYYY.json.gz` (previous UTC day before 08:00), extracts it, and immediately removes the archive. All temporary files are removed on completion or failure.

Run `npm run import:collections` for a one-off import or `npm run schedule:collections` for the worker. The Admin jobs panel also supports manual execution. Concurrent imports are prevented by a PostgreSQL advisory lock; failed entries are logged and retried on subsequent runs. Existing successfully stored collections are skipped and retained unchanged.

Each new collection requires one collection-details request, using English metadata and the supplied poster/backdrop paths and member summaries. No image-gallery or individual movie requests are made, and no movies are written to movie tables by this importer. The **Movies → Collections** tab and collection detail pages use stored summaries only. A member movie is fetched and saved through the existing movie-detail flow only when clicked. Existing movie import jobs are unchanged.

The Rating sort orders collection cards by their average member-movie TMDB rating, highest first, with name/ID tie-breakers. The average is unweighted and uses the stored collection summaries; zero or missing ratings are treated as unrated and excluded. Unrated collections appear last. Both collection and member movie ratings are displayed out of 10 without extra TMDB requests.

Popularity is displayed beside ratings on collections and their member movies. Collection popularity is the unweighted average of available member popularity values (zero counts; missing values do not). The collection list offers Popularity (default) and Rating sorts, descending with missing values last. Search, pagination, and detail/back navigation preserve the selected sort. All scores come from stored summaries.
