/**
 * Scan de code-barres (EAN-13/EAN-8/UPC) avec la caméra.
 *
 * Safari sur iPhone n'a pas d'API de lecture de code-barres intégrée : on utilise
 * la bibliothèque zxing (WebAssembly, embarquée dans l'appli, fonctionne hors ligne).
 * Fiabilité : bonne sur les emballages plats et bien éclairés ; moins bonne sur les
 * emballages courbes ou froissés. Repli toujours disponible : saisir les chiffres du code.
 */
import { BarcodeDetector, setZXingModuleOverrides } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { isValidEan } from './ean'

export { isValidEan }

setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
})

let detector: BarcodeDetector | undefined
function getDetector() {
  detector ??= new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
  return detector
}

/** Analyse une image vidéo ; renvoie le premier code valide trouvé. */
export async function detectFrom(source: HTMLVideoElement): Promise<string | undefined> {
  const found = await getDetector().detect(source)
  return found.map((b) => b.rawValue).find(isValidEan)
}
