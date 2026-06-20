import { describe, it, expect } from 'vitest'
import { collectionColor } from '../collectionColor.js'

describe('collectionColor', () => {
  it('returns a hex color string', () => {
    expect(collectionColor('Lord of the Rings Trilogy')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('returns the same color for the same name', () => {
    expect(collectionColor('Indiana Jones')).toBe(collectionColor('Indiana Jones'))
  })

  it('handles empty string without throwing', () => {
    expect(collectionColor('')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
