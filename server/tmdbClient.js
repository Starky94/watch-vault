export async function fetchPopularMoviesPage(fetchImpl, options) {
  const { token, page, baseUrl } = options
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const url = new URL('movie/popular', normalizedBaseUrl)
  url.searchParams.set('page', String(page))

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`TMDB request failed with status ${response.status}: ${body}`)
  }

  return response.json()
}
