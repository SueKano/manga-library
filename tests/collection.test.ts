import { describe, expect, it } from 'vitest'
import { computeSummary, formatRanges, lastPurchase, statusPhrase } from '@/utils/collection'
import { matches, normalize } from '@/utils/text'

describe('computeSummary', () => {
  it('no volumes: next is 1', () => {
    const summary = computeSummary([], null)
    expect(summary).toMatchObject({ last: null, next: 1, gaps: [], percent: null, complete: false })
    expect(statusPhrase(summary)).toBe('Siguiente: 1')
  })

  it('contiguous collection', () => {
    const summary = computeSummary([1, 2, 3], null)
    expect(summary).toMatchObject({ last: 3, next: 4, gaps: [] })
    expect(statusPhrase(summary)).toBe('Siguiente: 4')
  })

  it('detects gaps: owning 1,2,3,5 → 4 is missing', () => {
    const summary = computeSummary([1, 2, 3, 5], null)
    expect(summary.gaps).toEqual([4])
    expect(summary.last).toBe(5)
    expect(summary.next).toBe(6)
  })

  it('gap at the start and multiple gaps', () => {
    expect(computeSummary([3], null).gaps).toEqual([1, 2])
    expect(computeSummary([2, 5, 9], null).gaps).toEqual([1, 3, 4, 6, 7, 8])
  })

  it('sorts and drops duplicates and invalid numbers', () => {
    const summary = computeSummary([5, 1, 3, 3, 0, -2, 1.5], null)
    expect(summary.owned).toEqual([1, 3, 5])
  })

  it('percentage with a known total', () => {
    expect(computeSummary([1, 2, 3], 12).percent).toBe(25)
    expect(computeSummary([], 10).percent).toBe(0)
  })

  it('complete series: there is no next volume', () => {
    const summary = computeSummary([1, 2, 3], 3)
    expect(summary).toMatchObject({ next: null, percent: 100, complete: true })
    expect(statusPhrase(summary)).toBe('Al día · Último tomo: 3')
    expect(statusPhrase(summary, true)).toBe('Colección completa (3)')
  })

  it('owning the last volume but with gaps is not complete', () => {
    const summary = computeSummary([1, 3], 3)
    expect(summary).toMatchObject({ next: null, gaps: [2], complete: false, percent: 67 })
    expect(statusPhrase(summary)).toBe('Solo faltan huecos · Último tomo: 3')
  })

  it('a total of 0 or null is treated as unknown', () => {
    expect(computeSummary([1], 0)).toMatchObject({ next: 2, percent: null })
  })

  it('volumes above the total do not inflate the percentage', () => {
    const summary = computeSummary([1, 2, 5], 4)
    expect(summary.percent).toBe(50)
    expect(summary.complete).toBe(false)
  })
})

describe('missing volumes', () => {
  it('with a known total counts everything left up to the total', () => {
    expect(computeSummary([1, 2, 5], 12).missing).toBe(9)
    expect(computeSummary([], 10).missing).toBe(10)
    expect(computeSummary([1, 2, 3], 3).missing).toBe(0)
  })

  it('with an unknown total only the gaps are known to be missing', () => {
    expect(computeSummary([1, 2, 5], null).missing).toBe(2)
    expect(computeSummary([1, 2, 3], null).missing).toBe(0)
  })
})

describe('lastPurchase', () => {
  const volume = (number: number, purchaseDate?: string, owned = true) => ({ number, owned, purchaseDate })

  it('picks the most recent purchase date, not the highest number', () => {
    const volumes = [volume(1), volume(7, '2026-03-01'), volume(4, '2026-11-14'), volume(9, '2026-01-20')]
    expect(lastPurchase(volumes)).toEqual({ number: 4, date: '2026-11-14' })
  })

  it('on the same day, the highest number wins', () => {
    expect(lastPurchase([volume(3, '2026-11-14'), volume(5, '2026-11-14')])?.number).toBe(5)
  })

  it('ignores undated and unowned volumes', () => {
    expect(lastPurchase([volume(1), volume(2)])).toBeNull()
    expect(lastPurchase([volume(2, '2026-11-14', false)])).toBeNull()
    expect(lastPurchase([])).toBeNull()
  })
})

describe('formatRanges', () => {
  it('groups consecutive numbers', () => {
    expect(formatRanges([1, 2, 3, 5, 7, 8])).toBe('1-3, 5, 7-8')
    expect(formatRanges([4])).toBe('4')
    expect(formatRanges([])).toBe('')
  })
})

describe('search', () => {
  it('normalizes accents and case', () => {
    expect(normalize('  Pokémon ÁÉÍÓÚ ñ ')).toBe('pokemon aeiou n')
  })
  it('matches every word in any order', () => {
    const text = normalize('Fullmetal Alchemist Hiromu Arakawa Norma')
    expect(matches(text, 'ARAKAWA full')).toBe(true)
    expect(matches(text, 'alquimista')).toBe(false)
    expect(matches(text, '')).toBe(true)
  })
})
