export function loadCollection<TItem, TState, TFeatured = unknown>(options: {
  url: string
  setState: (state: TState) => void
  loadingState: TState
  itemsKey: string
  mapItem: (item: TItem) => unknown
  featuredKey?: string
  mapFeatured?: (item: TFeatured) => unknown
  mapPagination?: (pagination: unknown) => unknown
  options?: RequestInit
  errorMessage: string
  fetchRequest?: typeof fetch
}): () => void

export function requestJson(url: string, options?: RequestInit, fetchRequest?: typeof fetch): Promise<unknown>
