export async function requestJson(url, options, fetchRequest = fetch) {
  const response = await fetchRequest(url, options)
  let payload
  try {
    payload = await response.json()
  } catch (error) {
    if (response.ok) throw error
    payload = {}
  }
  if (!response.ok) throw new Error(payload?.error || `Request failed with status ${response.status}`)
  return payload
}

export function loadCollection({
  url, options, setState, loadingState, itemsKey, mapItem, mapPagination,
  featuredKey, mapFeatured, errorMessage, fetchRequest,
}) {
  let cancelled = false
  setState(loadingState)

  async function load() {
    try {
      const payload = await requestJson(url, options, fetchRequest)
      const items = Array.isArray(payload[itemsKey]) ? payload[itemsKey].map(mapItem) : []
      if (!cancelled) setState({
        ...loadingState,
        status: 'success',
        [itemsKey]: items,
        ...(mapPagination ? { pagination: mapPagination(payload.pagination) } : {}),
        ...(featuredKey ? { [featuredKey]: payload[featuredKey] ? mapFeatured(payload[featuredKey]) : null } : {}),
        error: '',
      })
    } catch (error) {
      if (!cancelled) setState({
        ...loadingState,
        status: 'error',
        error: error instanceof Error ? error.message : errorMessage,
      })
    }
  }

  void load()
  return () => { cancelled = true }
}
