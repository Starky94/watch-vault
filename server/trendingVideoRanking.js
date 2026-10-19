export const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/
const excluded = /\b(gameplay|gaming|video game|reaction|reacts|fan[ -]?made|fan trailer|concept trailer|concept teaser|AI trailer|unofficial|music video|lyric video|walkthrough|roblox|minecraft|fortnite)\b/i
const categories = [
  ['Behind the Scenes', /behind[ -]the[ -]scenes|making[ -]of/i],
  ['Featurette', /featurette/i], ['Interview', /interview/i],
  ['Teaser', /teaser/i], ['Trailer', /trailer/i],
  ['Promotional Clip', /\bclip\b|first look|announcement|promo|sneak peek/i],
]

export function classifyVideo(video, association, trusted) {
  const title = video.snippet?.title ?? ''
  if (excluded.test(title)) return null
  // Popularity and a self-described "official" title are not evidence of legitimacy.
  if (!association && !trusted) return null
  const category = categories.find(([, pattern]) => pattern.test(title))?.[0]
  if (!association) return category ?? null
  const knownType = { Trailer: 'Trailer', Teaser: 'Teaser', Featurette: 'Featurette', 'Behind the Scenes': 'Behind the Scenes', Clip: 'Promotional Clip' }[association.type]
  return knownType ?? category ?? null
}

export function rankTrendingVideos(candidates, { previous = [], previousAt, now = Date.now(), trustedChannels = new Set(), limit = 60 } = {}) {
  const prior = new Map(previous.map((video) => [video.id, video]))
  const elapsedHours = (now - new Date(previousAt).getTime()) / 3600_000
  const ranked = []
  for (const candidate of candidates) {
    const { video, association, sources = [] } = candidate
    const regions = [...(candidate.regions ?? [])]
    if (!youtubeIdPattern.test(video.id) || video.status?.privacyStatus !== 'public' || video.status?.uploadStatus !== 'processed' || video.snippet?.liveBroadcastContent === 'upcoming') continue
    const published = Date.parse(video.snippet?.publishedAt)
    const ageHours = (now - published) / 3600_000
    if (!Number.isFinite(ageHours) || ageHours < 0) continue
    const trusted = trustedChannels.has(video.snippet.channelId)
    const category = classifyVideo(video, association, trusted)
    if (!category) continue
    const rawViews = Number(video.statistics?.viewCount)
    const views = Number.isFinite(rawViews) && rawViews >= 0 ? rawViews : null
    const old = prior.get(video.id)
    const measured = old?.views != null && views != null && elapsedHours >= 0.25 && elapsedHours <= 48
    const velocity = measured ? Math.max(0, views - old.views) / elapsedHours : (views ?? 0) / Math.max(6, ageHours)
    // Older videos qualify only with observed renewed engagement or a current regional chart.
    if (ageHours > 7 * 24 && !regions.length && !(measured && velocity >= 1000)) continue
    const score = 4 * Math.log1p(velocity) + 1.3 * Math.log1p(views ?? 0)
      + 4 * Math.exp(-ageHours / 72) + Math.min(4, regions.length) * 1.5
      + (trusted ? 3 : 0) + (association?.official ? 3 : 0)
    ranked.push({
      id: video.id, title: video.snippet.title, category,
      channelId: video.snippet.channelId, channel: video.snippet.channelTitle,
      thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      publishedAt: new Date(published).toISOString(), views,
      embeddable: video.status.embeddable === true,
      regions: [...regions].sort(), sources: [...sources].sort(),
      media: association ? { id: association.id, kind: association.kind, title: association.title } : null,
      badge: ageHours <= 24 ? 'NEW' : measured && velocity >= 1000 ? 'RISING' : regions.length >= 2 ? 'TRENDING' : null,
      score,
    })
  }
  ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const selected = [], deferred = [], channels = new Map(), titles = new Map(), regions = new Map(), duplicates = new Set()
  for (const video of ranked) {
    // Collapse cross-channel copies with the same normalized promotional title.
    const fingerprint = `${video.media ? `${video.media.kind}:${video.media.id}:` : ''}${video.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()}`
    if (duplicates.has(fingerprint)) continue
    duplicates.add(fingerprint)
    const titleKey = video.media ? `${video.media.kind}:${video.media.id}` : video.id
    const onlyRegion = video.regions.length === 1 ? video.regions[0] : null
    if ((channels.get(video.channelId) ?? 0) >= 2 || (titles.get(titleKey) ?? 0) >= 2 || (onlyRegion && (regions.get(onlyRegion) ?? 0) >= 4)) {
      deferred.push(video)
      continue
    }
    selected.push(video)
    channels.set(video.channelId, (channels.get(video.channelId) ?? 0) + 1)
    titles.set(titleKey, (titles.get(titleKey) ?? 0) + 1)
    if (onlyRegion) regions.set(onlyRegion, (regions.get(onlyRegion) ?? 0) + 1)
  }
  // Diversity is a preference; still fill twelve slots if the candidate pool is narrow.
  return [...selected, ...deferred].slice(0, limit)
}
