import type { MovieCatalogFilters as Filters } from './movieCollections.ts'

const currentYear = new Date().getFullYear()

interface Props {
  value: Filters
  onChange: (value: Filters) => void
  genres: { id: number; name: string }[]
  isSignedIn: boolean
  mediaLabel?: string
}

export function MovieCatalogFilters({ value, onChange, genres, isSignedIn, mediaLabel = 'movies' }: Props) {
  const update = (patch: Partial<Filters>) => onChange({ ...value, ...patch })
  const decades = Array.from({ length: Math.floor((currentYear - 1870) / 10) + 1 }, (_, index) => Math.floor(currentYear / 10) * 10 - index * 10)
  return <section className="movie-catalog-filters" aria-label={`Filter all ${mediaLabel}`}>
    <label>Year<select value={value.year} onChange={(event) => update({ year: event.target.value, decade: '' })}>
      <option value="">Any year</option>
      {Array.from({ length: currentYear + 6 - 1870 }, (_, index) => currentYear + 5 - index).map((year) => <option key={year} value={year}>{year}</option>)}
    </select></label>
    <label>Decade<select value={value.decade} onChange={(event) => update({ decade: event.target.value, year: '' })}>
      <option value="">Any decade</option>
      {decades.map((decade) => <option key={decade} value={decade}>{decade}s</option>)}
    </select></label>
    <label>Genre<select value={value.genre} onChange={(event) => update({ genre: event.target.value })}>
      <option value="">Any genre</option>
      {genres.map((genre) => <option key={genre.id} value={genre.name}>{genre.name}</option>)}
    </select></label>
    <fieldset className="movie-rating-filter"><legend>Rating: {value.minRating.toFixed(1)} – {value.maxRating.toFixed(1)}</legend>
      <label>Min<input aria-label="Minimum rating" type="range" min="0" max="10" step="0.1" value={value.minRating} onChange={(event) => update({ minRating: Math.min(Number(event.target.value), value.maxRating) })} /></label>
      <label>Max<input aria-label="Maximum rating" type="range" min="0" max="10" step="0.1" value={value.maxRating} onChange={(event) => update({ maxRating: Math.max(Number(event.target.value), value.minRating) })} /></label>
    </fieldset>
    <label className="movie-catalog-checkbox"><input type="checkbox" checked={value.streamingOnly} onChange={(event) => update({ streamingOnly: event.target.checked })} />Streaming platform<span>Subscription streaming only</span></label>
    <label className="movie-catalog-checkbox"><input type="checkbox" checked={value.excludeWatched} disabled={!isSignedIn} onChange={(event) => update({ excludeWatched: event.target.checked })} />Exclude watched{!isSignedIn ? <span>Sign in to exclude watched {mediaLabel}</span> : null}</label>
  </section>
}
