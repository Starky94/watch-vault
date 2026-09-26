import { ACHIEVEMENTS } from './achievements.js'
import { WATCH_TOGETHER_ACHIEVEMENTS, WATCH_TOGETHER_AUTOMATIC_GENRE_RULES } from './watchTogetherAchievements.js'

const stamp = (row) => new Date(row.occurred_at).getTime()
const day = (row) => new Date(row.occurred_at).toISOString().slice(0, 10)
const ordered = (rows) => [...rows].sort((a, b) => stamp(a) - stamp(b) || Number(a.event_id || a.entity_id) - Number(b.event_id || b.entity_id))
const unique = (values) => [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))]
const names = (row) => unique((row.genre_names || []).map((name) => String(name).trim()))
const idList = (row, key) => unique(row[key] || []).map(String)
const asDate = (value) => value ? String(value).slice(0, 10) : null
const yearOf = (value) => Number(asDate(value)?.slice(0, 4)) || null
const minutes = (row) => Math.max(0, Number(row.runtime_minutes) || 0)
const first = (rows, target) => rows.slice(0, target)
const evidence = (current, rows = []) => ({ current, rows })

function distinctEvidence(rows, valuesOf, target, allowed = null) {
  const seen = new Set()
  const chosen = []
  for (const row of rows) {
    const fresh = unique(valuesOf(row)).filter((value) => (!allowed || allowed.has(value)) && !seen.has(value))
    if (!fresh.length) continue
    fresh.forEach((value) => seen.add(value))
    chosen.push({ ...row, qualifier: fresh.join(', ') })
  }
  return evidence(seen.size, first(chosen, target))
}

function totalEvidence(rows, target) {
  let total = 0
  const chosen = []
  for (const row of rows) {
    if (total < target) chosen.push({ ...row, qualifier: `${minutes(row)} min` })
    total += minutes(row)
  }
  return evidence(total, chosen)
}

function groupedEvidence(rows, keyOf, target, amountOf = () => 1) {
  const groups = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    if (key === null) continue
    if (!groups.has(key)) groups.set(key, { key, amount: 0, rows: [] })
    const group = groups.get(key)
    group.amount += amountOf(row)
    group.rows.push(row)
  }
  const candidates = [...groups.values()].sort((a, b) => stamp(a.rows[0]) - stamp(b.rows[0]) || a.key.localeCompare(b.key))
  const winning = candidates.find((group) => group.amount >= target) || [...candidates].sort((a, b) => b.amount - a.amount || stamp(a.rows[0]) - stamp(b.rows[0]))[0]
  if (!winning) return evidence(0)
  let amount = 0
  const chosen = []
  for (const row of winning.rows) {
    if (amount < target) chosen.push({ ...row, qualifier: winning.key })
    amount += amountOf(row)
  }
  return evidence(Math.max(...candidates.map((group) => group.amount)), chosen)
}

function consecutiveEvidence(rows, keyOf, target) {
  const buckets = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    if (key !== null && !buckets.has(key)) buckets.set(key, row)
  }
  const keys = [...buckets.keys()].sort()
  let run = []; let best = []; let winner = null
  for (const key of keys) {
    const previous = run.at(-1)
    run = previous && Date.parse(`${key}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === 86400000 ? [...run, key] : [key]
    if (run.length > best.length) best = run
    if (!winner && run.length >= target) winner = [...run]
  }
  return evidence(best.length, (winner || best).slice(0, target).map((key) => ({ ...buckets.get(key), qualifier: key })))
}

function rollingEvidence(rows, target) {
  let best = []; let winner = null
  for (let start = 0; start < rows.length; start += 1) {
    const firstDay = Date.parse(`${day(rows[start])}T00:00:00Z`)
    const window = rows.slice(start).filter((row) => Date.parse(`${day(row)}T00:00:00Z`) - firstDay < 30 * 86400000)
    if (window.length > best.length) best = window
    if (!winner && window.length >= target) winner = window.slice(0, target)
  }
  return evidence(best.length, winner || best)
}

function maxSharedValue(rows, valuesOf, target, label) {
  const groups = new Map()
  for (const row of rows) for (const value of unique(valuesOf(row))) {
    const key = String(value)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const candidates = [...groups.entries()].sort((a, b) => stamp(a[1][0]) - stamp(b[1][0]) || a[0].localeCompare(b[0]))
  const winner = candidates.find(([, items]) => items.length >= target) || [...candidates].sort((a, b) => b[1].length - a[1].length || stamp(a[1][0]) - stamp(b[1][0]))[0]
  return evidence(Math.max(0, ...candidates.map(([, items]) => items.length)), winner ? first(winner[1], target).map((row) => ({ ...row, qualifier: label || winner[0] })) : [])
}

function openingWeekend(row) {
  const releases = row.detail_payload?.release_dates?.results?.find((item) => item?.iso_3166_1 === 'US')?.release_dates || []
  const released = asDate(releases.find((item) => item?.type === 3)?.release_date) || asDate(row.release_date)
  if (!released) return false
  const offset = (Date.parse(`${day(row)}T00:00:00Z`) - Date.parse(`${released}T00:00:00Z`)) / 86400000
  return offset >= 0 && offset <= 2
}

function movieContributor(row) {
  return { id: row.tmdb_id, mediaType: 'movie', title: row.title, year: yearOf(row.release_date), posterPath: row.poster_path ?? null, watchedAt: row.occurred_at, watched: row.event_type === 'movie_watched', qualifier: row.qualifier || null }
}

function showContributor(row) {
  return { id: row.tmdb_id, mediaType: 'tv', title: row.episode_name ? `${row.name} · ${row.episode_name}` : row.name, episodeId: row.episode_tmdb_id ?? null, episodeTitle: row.episode_name ?? null, seasonNumber: row.season_number ?? null, episodeNumber: row.episode_number ?? null, year: yearOf(row.first_air_date), posterPath: row.poster_path ?? null, watchedAt: row.occurred_at, watched: ['tv_show_completed', 'tv_episode_watched'].includes(row.event_type), qualifier: row.qualifier || null }
}

export function evaluateMovieTvAchievementEvidence({ movies = [], shows = [], episodes = [], watchlistCount = 0 } = {}) {
  const movieRows = ordered(movies)
  const showRows = ordered(shows)
  const episodeRows = ordered(episodes)
  const watched = movieRows.filter((row) => row.event_type === 'movie_watched')
  const rated = movieRows.filter((row) => row.event_type === 'movie_rated')
  const saved = movieRows.filter((row) => row.event_type === 'movie_watchlist_added')
  const completed = showRows.filter((row) => row.event_type === 'tv_show_completed')
  const tvSaved = showRows.filter((row) => row.event_type === 'tv_watchlist_added')
  const tvRated = episodeRows.filter((row) => row.event_type === 'tv_rated')
  const tvWatched = episodeRows.filter((row) => row.event_type === 'tv_episode_watched')
  const savedAt = new Map(saved.map((row) => [String(row.entity_id), stamp(row)]))
  const watchedFromList = watched.filter((row) => savedAt.has(String(row.entity_id)) && savedAt.get(String(row.entity_id)) <= stamp(row))
  const expectedDecades = new Set(Array.from({ length: 11 }, (_, index) => 1920 + index * 10))
  const result = new Map()
  for (const achievement of ACHIEVEMENTS) {
    if (achievement.availability !== 'active') continue
    const { rule, target } = achievement
    let value
    if (rule === 'movie_count') value = evidence(watched.length, first(watched, target))
    else if (rule === 'show_count') value = evidence(completed.length, first(completed, target))
    else if (rule === 'movie_rating_count') value = evidence(rated.length, first(rated, target).map((row) => ({ ...row, qualifier: `Rated ${row.metadata?.score}/5` })))
    else if (rule === 'tv_rating_count') value = evidence(tvRated.length, first(tvRated, target).map((row) => ({ ...row, qualifier: `Rated ${row.metadata?.score}/5` })))
    else if (rule === 'movie_watchlist_count') value = evidence(saved.length, first(saved, target).map((row) => ({ ...row, qualifier: 'Added to watchlist' })))
    else if (rule === 'tv_watchlist_count') value = evidence(tvSaved.length, first(tvSaved, target).map((row) => ({ ...row, qualifier: 'Added to watchlist' })))
    else if (rule === 'movie_watchlist_watched') value = evidence(watchedFromList.length, first(watchedFromList, target).map((row) => ({ ...row, qualifier: 'Watched from watchlist' })))
    else if (rule === 'movie_runtime') value = totalEvidence(watched, target)
    else if (rule === 'tv_runtime') value = totalEvidence(tvWatched, target)
    else if (rule === 'movie_streak') value = consecutiveEvidence(watched, day, target)
    else if (rule === 'daily_movies') value = groupedEvidence(watched, day, target)
    else if (rule === 'daily_runtime') value = groupedEvidence(watched, day, target, minutes)
    else if (rule === 'rolling_30_movies') value = rollingEvidence(watched, target)
    else if (rule === 'weekend_movies') value = groupedEvidence(watched, (row) => { const date = new Date(row.occurred_at); if (![0, 6].includes(date.getUTCDay())) return null; const monday = new Date(`${day(row)}T00:00:00Z`); monday.setUTCDate(monday.getUTCDate() - (date.getUTCDay() === 0 ? 6 : 5)); return monday.toISOString().slice(0, 10) }, target)
    else if (rule.startsWith('genre:')) { const genre = rule.slice(6); const matches = watched.filter((row) => names(row).some((name) => name.toLowerCase() === genre.toLowerCase())); value = evidence(matches.length, first(matches, target).map((row) => ({ ...row, qualifier: genre }))) }
    else if (rule === 'genre_diversity') value = distinctEvidence(watched, names, target)
    else if (rule === 'rating_scale') value = distinctEvidence(rated, (row) => [Number(row.metadata?.score)], target)
    else if (rule === 'low_ratings' || rule === 'high_ratings') { const score = rule === 'low_ratings' ? 1 : 5; const matches = rated.filter((row) => Number(row.metadata?.score) === score); value = evidence(matches.length, first(matches, target).map((row) => ({ ...row, qualifier: `${score}/5` }))) }
    else if (rule === 'decade_diversity' || rule === 'decade_challenge') value = distinctEvidence(watched, (row) => { const year = yearOf(row.release_date); return year ? [Math.floor(year / 10) * 10] : [] }, target)
    else if (rule === 'time_traveller') value = distinctEvidence(watched, (row) => { const year = yearOf(row.release_date); return year ? [Math.floor(year / 10) * 10] : [] }, target, expectedDecades)
    else if (rule === 'foreign_language') { const matches = watched.filter((row) => row.original_language && row.original_language !== 'en'); value = evidence(matches.length, first(matches, target).map((row) => ({ ...row, qualifier: row.original_language.toUpperCase() }))) }
    else if (rule === 'classic_movies') { const matches = watched.filter((row) => yearOf(row.release_date) && yearOf(row.release_date) < 1970); value = evidence(matches.length, first(matches, target)) }
    else if (rule === 'short_movie' || rule === 'long_movie') { const matches = watched.filter((row) => rule === 'short_movie' ? Number(row.runtime_minutes) > 0 && Number(row.runtime_minutes) < 80 : Number(row.runtime_minutes) > 180); value = evidence(matches.length, first(matches, target)) }
    else if (rule === 'opening_weekend') { const matches = watched.filter(openingWeekend); value = evidence(matches.length, first(matches, target)) }
    else if (rule === 'new_release_hunter') { const matches = watched.filter((row) => yearOf(row.release_date) === new Date(row.occurred_at).getUTCFullYear()); value = evidence(matches.length, first(matches, target)) }
    else if (rule === 'director_max') value = maxSharedValue(watched, (row) => idList(row, 'director_ids'), target, 'Same director')
    else if (rule === 'actor_max') value = maxSharedValue(watched, (row) => idList(row, 'actor_ids'), target, 'Same actor')
    else if (rule === 'actor_pair_max') value = maxSharedValue(watched, (row) => { const actors = idList(row, 'actor_ids').sort(); return actors.flatMap((actor, index) => actors.slice(index + 1).map((other) => `${actor}:${other}`)) }, target, 'Same actor pair')
    else if (rule === 'director_diversity') { value = distinctEvidence(watched, (row) => idList(row, 'director_ids'), target); value.rows = value.rows.map((row) => ({ ...row, qualifier: 'New director' })) }
    else if (rule === 'monday_movies' || rule === 'friday_movies' || rule === 'night_owl_movies' || rule === 'early_screening_movies' || rule === 'halloween_horror') {
      const matches = watched.filter((row) => { const date = new Date(row.occurred_at); return rule === 'monday_movies' ? date.getUTCDay() === 1 : rule === 'friday_movies' ? date.getUTCDay() === 5 : rule === 'night_owl_movies' ? date.getUTCHours() < 6 : rule === 'early_screening_movies' ? date.getUTCHours() < 12 : date.getUTCMonth() === 9 && date.getUTCDate() === 31 && names(row).includes('Horror') }); value = evidence(matches.length, first(matches, target))
    } else if (rule === 'monthly_regular' || rule === 'weekly_regular') {
      const keyOf = rule === 'monthly_regular' ? (row) => day(row).slice(0, 7) : (row) => { const date = new Date(`${day(row)}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10) }
      const units = new Map(); for (const row of watched) { const key = keyOf(row); if (!units.has(key)) units.set(key, row) }
      const keys = [...units.keys()].sort(); let run = []; let best = []; let winner = null
      for (const key of keys) { const previous = run.at(-1); const currentDate = rule === 'monthly_regular' ? new Date(`${key}-01T00:00:00Z`) : new Date(`${key}T00:00:00Z`); const priorDate = previous ? rule === 'monthly_regular' ? new Date(`${previous}-01T00:00:00Z`) : new Date(`${previous}T00:00:00Z`) : null; const adjacent = priorDate && (rule === 'monthly_regular' ? currentDate.getUTCFullYear() * 12 + currentDate.getUTCMonth() - (priorDate.getUTCFullYear() * 12 + priorDate.getUTCMonth()) === 1 : currentDate - priorDate === 7 * 86400000); run = adjacent ? [...run, key] : [key]; if (run.length > best.length) best = run; if (!winner && run.length >= target) winner = [...run] }
      value = evidence(best.length, (winner || best).slice(0, target).map((key) => ({ ...units.get(key), qualifier: key })))
    } else if (rule === 'yearly_days') value = groupedEvidence(distinctEvidence(watched, (row) => [day(row)], Number.MAX_SAFE_INTEGER).rows, (row) => day(row).slice(0, 4), target)
    else if (rule === 'genre_month') value = maxSharedValue(watched, (row) => names(row).map((name) => `${day(row).slice(0, 7)} · ${name}`), target)
    else if (rule === 'alphabet_challenge') value = distinctEvidence(watched, (row) => { const letter = String(row.title || '').trim().charAt(0).toUpperCase(); return /^[A-Z]$/.test(letter) ? [letter] : [] }, target)
    else if (rule === 'zero_backlog') value = evidence(saved.length && watchlistCount === 0 ? 1 : 0, saved.length && watchlistCount === 0 ? [saved[0]] : [])
    else if (rule === 'forgotten_treasure') { const matches = watched.filter((row) => savedAt.has(String(row.entity_id)) && stamp(row) - savedAt.get(String(row.entity_id)) >= 365 * 86400000); value = evidence(matches.length, first(matches, target)) }
    else if (['against_crowd', 'hidden_gem_hunter', 'so_bad_its_good', 'everyone_hated_it', 'everyone_loved_it'].includes(rule)) {
      const matches = rated.filter((row) => { const score = Number(row.metadata?.score); const count = Number(row.community_count); const average = Number(row.community_average); return rule === 'against_crowd' ? Number(row.vote_count) >= 1000 && count >= 5 && score <= average - 1.5 : rule === 'hidden_gem_hunter' ? score >= 4 && count <= 5 : rule === 'so_bad_its_good' ? Number(row.vote_average) <= 5 && score >= 4.5 : rule === 'everyone_hated_it' ? count >= 5 && average <= 2.5 && score >= 4.5 : count >= 5 && average >= 4.5 && score <= 2 }); value = evidence(matches.length, first(matches, target))
    } else if (rule === 'double_feature') { let chosen = []; for (let index = 1; index < watched.length; index += 1) { if (stamp(watched[index]) - stamp(watched[index - 1]) <= 6 * 3600000) { chosen = [watched[index - 1], watched[index]]; break } } value = evidence(chosen.length, chosen) }
    if (!value) throw new Error(`Missing evidence evaluator for achievement rule: ${rule}`)
    const map = achievement.media === 'tv' ? showContributor : movieContributor
    result.set(achievement.id, { current: value.current, contributors: value.rows.map(map) })
  }
  return result
}

export function evaluateWatchTogetherAchievementEvidence({ movies = [], episodes = [] } = {}) {
  const rows = [...movies.map((row) => ({ ...row, sharedKind: 'movie', occurred_at: row.watched_together_at })), ...episodes.map((row) => ({ ...row, sharedKind: 'episode', occurred_at: row.watched_together_at }))]
  const all = ordered(rows)
  const result = new Map()
  for (const achievement of WATCH_TOGETHER_ACHIEVEMENTS) {
    const { id, target } = achievement
    let value
    if (achievement.tracking === 'manual') { const matches = all.filter((row) => (row.session_achievement_ids || []).includes(id)); value = evidence(matches.length, first(matches, target)) }
    else if (WATCH_TOGETHER_AUTOMATIC_GENRE_RULES.has(id)) { const genre = WATCH_TOGETHER_AUTOMATIC_GENRE_RULES.get(id); const matches = all.filter((row) => names(row).some((name) => name.toLowerCase() === genre.toLowerCase())); value = evidence(matches.length, first(matches, target).map((row) => ({ ...row, qualifier: genre }))) }
    else if (id === 'watch-together-genre-tourists') value = distinctEvidence(all, names, target)
    else if (['watch-together-better-together', 'watch-together-movie-night-regulars', 'watch-together-perfect-pairing', 'watch-together-cinema-companions', 'watch-together-dynamic-duo', 'watch-together-reel-soulmates'].includes(id)) value = evidence(movies.length, first(all.filter((row) => row.sharedKind === 'movie'), target))
    else if (id === 'watch-together-pilot-partners') { const pilots = all.filter((row) => row.sharedKind === 'episode' && Number(row.season_number) === 1 && Number(row.episode_number) === 1); value = evidence(pilots.length, first(pilots, target)) }
    else if (['watch-together-long-term-relationship', 'watch-together-episode-experts', 'watch-together-binge-legends'].includes(id)) value = evidence(episodes.length, first(all.filter((row) => row.sharedKind === 'episode'), target))
    if (!value) throw new Error(`Missing shared achievement evaluator: ${id}`)
    result.set(id, { current: value.current, rows: value.rows })
  }
  return result
}
