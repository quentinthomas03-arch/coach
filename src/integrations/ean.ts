/** Vrai pour un code EAN/UPC plausible (chiffres, longueur, clé de contrôle). */
export function isValidEan(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false
  const digits = code.padStart(13, '0').split('').map(Number)
  const check = digits.pop()!
  const sum = digits.reduce((a, d, i) => a + d * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10 === check
}
