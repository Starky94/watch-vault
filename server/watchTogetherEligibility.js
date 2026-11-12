// Episodes must already be ordered by season and episode, excluding specials
// and future episodes, just like the shared shortlist.
export function sharedEpisodeEligibility(episodes, watchedRows, currentUserId, partnerUserId) {
  const eligibleIds = new Set(episodes.map((episode) => Number(episode.id)))
  const watchedBy = (userId) => new Set(watchedRows
    .filter((row) => Number(row.user_id) === Number(userId) && eligibleIds.has(Number(row.tv_episode_id)))
    .map((row) => Number(row.tv_episode_id)))
  const mine = watchedBy(currentUserId)
  const partner = watchedBy(partnerUserId)
  if (mine.size !== partner.size || [...mine].some((id) => !partner.has(id))) {
    return { eligible: false, reason: 'progress_mismatch', nextEpisodeId: null }
  }
  const next = episodes.find((episode) => !mine.has(Number(episode.id)))
  return { eligible: Boolean(next), reason: next ? null : 'no_next_episode', nextEpisodeId: next ? Number(next.id) : null }
}
