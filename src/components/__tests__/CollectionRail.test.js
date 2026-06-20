import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/stores/collection.js', () => ({
  useCollectionStore: vi.fn()
}))
vi.mock('@/stores/tmdb.js', () => ({
  useTmdbStore: vi.fn()
}))

import { useCollectionStore } from '@/stores/collection.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import CollectionRail from '../CollectionRail.vue'

const siblings = [
  {
    id: 'lotr--120',
    title: 'The Fellowship of the Ring',
    collectionId: 'lotr',
    tmdbId: 120
  },
  {
    id: 'lotr--121',
    title: 'The Two Towers',
    collectionId: 'lotr',
    tmdbId: 121
  },
  {
    id: 'lotr--122',
    title: 'The Return of the King',
    collectionId: 'lotr',
    tmdbId: 122
  }
]

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
}

function mountRail(props, expandedMovies = siblings, getMovieData = () => null) {
  useCollectionStore.mockReturnValue({ expandedMovies })
  useTmdbStore.mockReturnValue({ getMovieData })
  return mount(CollectionRail, {
    props,
    global: { plugins: [makeRouter()] }
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('CollectionRail', () => {
  it('does not render when there are fewer than 2 siblings', () => {
    const oneSibling = [siblings[0]]
    const wrapper = mountRail({ collectionId: 'lotr', currentId: 'lotr--120' }, oneSibling)
    expect(wrapper.find('.rail').exists()).toBe(false)
  })

  it('does not render when there are zero siblings', () => {
    const wrapper = mountRail({ collectionId: 'lotr', currentId: 'lotr--120' }, [])
    expect(wrapper.find('.rail').exists()).toBe(false)
  })

  it('renders a poster card for each sibling when >= 2 siblings exist', () => {
    const wrapper = mountRail({ collectionId: 'lotr', currentId: 'lotr--120' })
    expect(wrapper.find('.rail').exists()).toBe(true)
    expect(wrapper.findAll('.rail-item')).toHaveLength(3)
  })

  it('renders each sibling title', () => {
    const wrapper = mountRail({ collectionId: 'lotr', currentId: 'lotr--120' })
    const titles = wrapper.findAll('.rail-title').map(el => el.text())
    expect(titles).toContain('The Fellowship of the Ring')
    expect(titles).toContain('The Two Towers')
    expect(titles).toContain('The Return of the King')
  })

  it('current film has .current CSS class', () => {
    const wrapper = mountRail({ collectionId: 'lotr', currentId: 'lotr--121' })
    const items = wrapper.findAll('.rail-item')
    // lotr--120 is index 0, lotr--121 is index 1, lotr--122 is index 2
    expect(items[0].classes()).not.toContain('current')
    expect(items[1].classes()).toContain('current')
    expect(items[2].classes()).not.toContain('current')
  })

  it('clicking a non-current sibling navigates to /movie/${sibling.id}', async () => {
    const router = makeRouter()
    const pushSpy = vi.spyOn(router, 'push')
    useCollectionStore.mockReturnValue({ expandedMovies: siblings })
    useTmdbStore.mockReturnValue({ getMovieData: () => null })
    const wrapper = mount(CollectionRail, {
      props: { collectionId: 'lotr', currentId: 'lotr--120' },
      global: { plugins: [router] }
    })
    const items = wrapper.findAll('.rail-item')
    // Click on the second item (lotr--121, not the current)
    await items[1].trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/movie/lotr--121')
  })

  it('does not navigate when clicking the current film', async () => {
    const router = makeRouter()
    const pushSpy = vi.spyOn(router, 'push')
    useCollectionStore.mockReturnValue({ expandedMovies: siblings })
    useTmdbStore.mockReturnValue({ getMovieData: () => null })
    const wrapper = mount(CollectionRail, {
      props: { collectionId: 'lotr', currentId: 'lotr--120' },
      global: { plugins: [router] }
    })
    const items = wrapper.findAll('.rail-item')
    // Click on the first item (lotr--120, the current)
    await items[0].trigger('click')
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('renders an img when posterPath is available', () => {
    const getMovieData = (id) => id === 'lotr--120' ? { posterPath: '/path/to/poster.jpg' } : null
    const wrapper = mountRail({ collectionId: 'lotr', currentId: 'lotr--999' }, siblings, getMovieData)
    const items = wrapper.findAll('.rail-item')
    expect(items[0].find('img').exists()).toBe(true)
    expect(items[0].find('img').attributes('src')).toBe('/path/to/poster.jpg')
  })

  it('renders placeholder when posterPath is null', () => {
    const wrapper = mountRail({ collectionId: 'lotr', currentId: 'lotr--120' })
    // All siblings have null posterPath (getMovieData returns null)
    const placeholders = wrapper.findAll('.rail-poster-placeholder')
    expect(placeholders).toHaveLength(3)
  })

  it('only shows siblings matching the given collectionId', () => {
    const mixed = [
      ...siblings,
      { id: 'other-col--999', title: 'Other Film', collectionId: 'other-col', tmdbId: 999 }
    ]
    const wrapper = mountRail({ collectionId: 'lotr', currentId: 'lotr--120' }, mixed)
    // Should show only lotr siblings (3), not the other-col one
    expect(wrapper.findAll('.rail-item')).toHaveLength(3)
  })
})
