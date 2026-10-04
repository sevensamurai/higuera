// The installed app must open without a network: sign in once, cut the connection, reload.
// Runs against a production build (see run-offline.sh); `npm run test:offline`.
import { chromium } from 'playwright'
const BASE = 'http://localhost:5175'
const FS = 'http://127.0.0.1:8080/v1/projects/demo-tutor-booking/databases/(default)/documents'
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-tutor-booking/databases/(default)/documents', { method: 'DELETE' })
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-tutor-booking/accounts', { method: 'DELETE' })

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
const errors = []
let failed = false
const check = (ok, what) => {
  console.log(ok ? '  ✓' : '  ✗', what)
  failed ||= !ok
}

const uidOf = async (email) =>
  (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-tutor-booking/accounts:query', {
    method: 'POST', headers: OWNER, body: '{}',
  }).then((r) => r.json())).userInfo.find((u) => u.email === email).localId

async function open(email, name) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 800 }, serviceWorkers: 'allow' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/login')
  await page.waitForFunction(() => '__e2eSignIn' in window)
  await page.evaluate(([e, n]) => window.__e2eSignIn(e, n), [email, name])
  await page.waitForURL(BASE + '/')
  return { ctx, page, uid: await uidOf(email) }
}
const when = new Date(Date.now() + 3 * 86_400_000).toISOString()
const seed = (userId, title) =>
  fetch(`${FS}/bookings/${userId}`, {
    method: 'PATCH', headers: OWNER,
    body: JSON.stringify({ fields: {
      userId: { stringValue: userId }, userName: { stringValue: 'Sam Student' }, userEmail: { stringValue: 'sam@example.com' },
      kind: { stringValue: 'tutoring' }, title: { stringValue: title }, notes: { stringValue: '' }, status: { stringValue: 'confirmed' },
      payment: { stringValue: 'pending' }, options: { arrayValue: { values: [] } },
      confirmed: { mapValue: { fields: { slotId: { stringValue: 's' }, start: { timestampValue: when }, durationMin: { integerValue: '60' } } } },
      createdAt: { timestampValue: new Date().toISOString() },
    } }),
  })
/** Loads once online (filling the caches), then reloads under `degrade`, and reports how long the page took. */
async function reloadUnder(page, ctx, path, selector, degrade) {
  await page.goto(BASE + path)
  await page.waitForSelector(selector)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForTimeout(1500) // let the worker finish precaching
  await degrade()
  const t0 = Date.now()
  await page.goto(BASE + path, { waitUntil: 'load' })
  try {
    await page.waitForSelector(selector, { timeout: 15_000 })
    return Date.now() - t0
  } catch {
    return null
  }
}

console.log('· the researcher opens the app offline')
{
  const { ctx, page, uid } = await open('tess@example.com', 'Tess Tutor')
  await fetch(`${FS}/admins/${uid}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: { email: { stringValue: 'tess@example.com' } } }) })
  await seed('sam-uid', 'Who were Maria Silva\'s parents?')
  await page.reload()
  await page.waitForSelector('.grid-stats a[href="/admin/requests"]')
  const ms = await reloadUnder(page, ctx, '/', '.grid-stats a[href="/admin/requests"]', () => ctx.setOffline(true))
  check(ms !== null && ms < 8000, `researcher dashboard opens offline (${ms ?? 'never'} ms)`)
  check((await page.locator('text=Who were Maria Silva').count()) > 0, 'her sessions show from the local copy')
  check((await page.locator('a[href="/book"]').count()) === 0, 'and it is the researcher\'s view, not the client\'s')
  await ctx.close()
}

console.log('· a client opens the app offline, with their own sessions')
{
  const { ctx, page, uid } = await open('sam@example.com', 'Sam Student')
  await seed(uid, 'Baptism records in Talca')
  const ms = await reloadUnder(page, ctx, '/sessions', 'text=Baptism records in Talca', () => ctx.setOffline(true))
  check(ms !== null && ms < 8000, `their sessions show offline (${ms ?? 'never'} ms)`)
  await ctx.close()
}

console.log('· connected, but the database never answers (a very poor connection)')
{
  const { ctx, page, uid } = await open('tess@example.com', 'Tess Tutor')
  void uid
  const ms = await reloadUnder(page, ctx, '/', '.grid-stats a[href="/admin/requests"]', () =>
    ctx.route(/127\.0\.0\.1:8080/, () => {})) // Firestore: never answered, never refused
  check(ms !== null && ms > 3000 && ms < 9000, `waits a few seconds, then opens on what the device knows (${ms ?? 'never'} ms)`)
  await ctx.close()
}

await browser.close()
check(errors.length === 0, errors.length ? `page errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors')
process.exit(failed ? 1 : 0)
