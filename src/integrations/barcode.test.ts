import { describe, expect, it } from 'vitest'
// On teste uniquement la validation (le scan lui-même nécessite une caméra).
import { isValidEan } from './ean'

describe('codes EAN', () => {
  it('valide les codes réels et rejette les erreurs de saisie', () => {
    expect(isValidEan('3017620422003')).toBe(true) // EAN-13
    expect(isValidEan('3017620422004')).toBe(false)
    expect(isValidEan('96385074')).toBe(true) // EAN-8
    expect(isValidEan('abc')).toBe(false)
  })
})
