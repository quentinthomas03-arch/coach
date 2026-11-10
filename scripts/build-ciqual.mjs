// Convertit la table Ciqual (Anses, Licence Ouverte) en un JSON compact pour l'appli.
// Source utilisée : export JSON « waistline_ciqual.json » (Ciqual 2025) du dépôt
// github.com/LaurentPortefaix/waistline-ciqual (MIT), lui-même issu de ciqual.anses.fr.
// Usage : node scripts/build-ciqual.mjs <chemin/waistline_ciqual.json>
// Sortie : public/data/ciqual.json — [code, nom, groupe, kcal, protéines, glucides, lipides, fibres] pour 100 g.
import { readFileSync, writeFileSync } from 'node:fs'

const src = process.argv[2]
if (!src) throw new Error('Chemin du fichier source manquant')
const { foodList } = JSON.parse(readFileSync(src, 'utf8'))

/** « 12,3 » « traces » « < 0.5 » « - » → nombre (traces et « < x » comptés 0, valeur prudente). */
const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v !== 'string') return 0
  const s = v.trim().replace(',', '.')
  if (!s || s === '-' || /trace/i.test(s) || s.startsWith('<')) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
const r1 = (n) => Math.round(n * 10) / 10

const out = foodList
  .map((f) => [
    Number(f.uniqueId),
    String(f.name).trim(),
    String(f.brand ?? '').replace(/^CIQUAL - /, '').trim(),
    Math.round(num(f.nutrition?.calories)),
    r1(num(f.nutrition?.proteins)),
    r1(num(f.nutrition?.carbohydrates)),
    r1(num(f.nutrition?.fat)),
    r1(num(f.nutrition?.fiber)),
  ])
  .filter((x) => x[1] && x[3] >= 0)
  .sort((a, b) => a[1].localeCompare(b[1], 'fr'))

writeFileSync('public/data/ciqual.json', JSON.stringify({ source: 'Anses, Table Ciqual 2025, Licence Ouverte', count: out.length, foods: out }))
console.log(`${out.length} aliments écrits`)
