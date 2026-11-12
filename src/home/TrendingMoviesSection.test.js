import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

// Vite loads the same TSX module used in production, without a separate JSX test toolchain.
test('Trending Now renders preview-only cards, TMDB states, and the existing See all action', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { TrendingMoviesSection } = await server.ssrLoadModule('/src/home/HomeScreen.tsx')
    const opened = []
    const open = (movie) => opened.push(movie.id)
    const seeAll = () => {}
    let sectionAction
    const cards = []
    const ui = {
      ContentSection: ({ title, action, onAction, children }) => {
        sectionAction = onAction
        return React.createElement('section', null, title, action, children)
      },
      SectionMessage: ({ message }) => React.createElement('p', null, message),
      RatingCard: (props) => {
        cards.push(props)
        return React.createElement('article', null, props.item.title)
      },
    }
    const actions = { onOpenMovie: open, onOpenPopularMovies: seeAll }
    const movies = Array.from({ length: 5 }, (_, id) => ({ id, title: `Trending ${id}`, posterUrl: null, kind: 'movie' }))
    const render = (status, items = [], error = '') => renderToStaticMarkup(React.createElement(TrendingMoviesSection, {
      ui, actions, data: { trendingMovies: items, trendingMoviesState: { status, movies: items, error } },
    }))
    const html = render('success', movies)
    assert.equal(cards.length, 5)
    assert.ok(html.includes('Trending Now'))
    assert.deepEqual(cards.map(({ item }) => item.id), [0, 1, 2, 3, 4])
    for (const card of cards) {
      assert.equal(card.onToggleWatchlist, undefined)
      assert.equal(card.onToggleWatched, undefined)
      assert.equal(card.item.posterUrl, null)
    }
    cards[0].onOpenMovie(cards[0].item)
    assert.deepEqual(opened, [0])
    assert.strictEqual(sectionAction, seeAll)
    assert.match(render('idle'), /Loading.*TMDB/)
    assert.match(render('loading'), /Loading.*TMDB/)
    assert.match(render('success'), /No trending movies are available from TMDB/)
    assert.match(render('error', [], 'TMDB unavailable'), /Could not load trending movies.*TMDB unavailable/)
  } finally { await server.close() }
})
