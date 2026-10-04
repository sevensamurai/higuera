// Renders every web/PWA icon from the one drawing, public/favicon.svg (the researcher's mark on a tile).
//   npm run icons
// Uses Playwright's Chromium (`npx playwright install chromium` once), or set CHROME_PATH to any Chrome.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const out = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url))
const tile = readFileSync(out('favicon.svg'), 'utf8')
if (!tile.includes('<rect width="64" height="64" rx="16"')) throw new Error('favicon.svg: expected the 64×64 rounded tile')

// The same mark, re-framed. viewBox units are the tile's 64; a bigger box pads the mark inward.
const frame = (box, rect) =>
  tile.replace('viewBox="0 0 64 64"', `viewBox="${box}"`).replace('<rect width="64" height="64" rx="16"', rect)
const variants = {
  // Rounded tile, transparent corners: browsers and "any" PWA icons.
  rounded: tile,
  // Square, a little padding: iOS rounds the corners itself and paints transparency black.
  square: frame('-4 -4 72 72', '<rect x="-4" y="-4" width="72" height="72"'),
  // Square, mark inside the central 80% (the maskable "safe zone"): Android crops to a circle or squircle.
  maskable: frame('-8 -8 80 80', '<rect x="-8" y="-8" width="80" height="80"'),
}

const icons = [
  ['pwa-192.png', 'rounded', 192],
  ['pwa-512.png', 'rounded', 512],
  ['pwa-maskable-192.png', 'maskable', 192],
  ['pwa-maskable-512.png', 'maskable', 512],
  ['apple-touch-icon.png', 'square', 180],
  ['favicon-32.png', 'rounded', 32],
]

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const page = await browser.newPage()
async function render(variant, size) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${variants[variant]}`)
  // Maskable and square icons are opaque: no transparent corners to be painted black.
  return page.screenshot({ omitBackground: variant === 'rounded' })
}

for (const [file, variant, size] of icons) {
  writeFileSync(out(file), await render(variant, size))
  console.log(`${file.padEnd(24)} ${size}×${size}  ${variant}`)
}

// favicon.ico: 16, 32 and 48 px PNGs in an ICO container, for browsers and tools that skip the SVG.
const sizes = [16, 32, 48]
const pngs = []
for (const s of sizes) pngs.push(await render('rounded', s)) // one at a time: they share a page
const head = Buffer.alloc(6 + 16 * sizes.length)
head.writeUInt16LE(1, 2) // type: icon
head.writeUInt16LE(sizes.length, 4)
let offset = head.length
sizes.forEach((s, i) => {
  const e = 6 + 16 * i
  head[e] = s
  head[e + 1] = s
  head.writeUInt16LE(1, e + 4) // colour planes
  head.writeUInt16LE(32, e + 6) // bits per pixel
  head.writeUInt32LE(pngs[i].length, e + 8)
  head.writeUInt32LE(offset, e + 12)
  offset += pngs[i].length
})
writeFileSync(out('favicon.ico'), Buffer.concat([head, ...pngs]))
console.log(`favicon.ico              ${sizes.join('/')} px`)

await browser.close()
