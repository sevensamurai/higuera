// End-to-end walk-through in two timezones (researcher in Santiago, client in Madrid), then in Spanish.
// Run with `npm run test:e2e`, which starts the emulators and the dev server around it (tests/run-e2e.sh).
// Screenshots of each step go to $E2E_SHOTS (default e2e-shots/). Wipes the emulator data first.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
const BASE = 'http://localhost:5173'
const FS = 'http://127.0.0.1:8080/v1/projects/demo-tutor-booking/databases/(default)/documents'
const SHOTS = process.argv[2] ?? 'e2e-shots'
mkdirSync(SHOTS, { recursive: true })
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-tutor-booking/databases/(default)/documents', { method: 'DELETE' })
await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-tutor-booking/accounts', { method: 'DELETE' })
const errors = []
const browser = await chromium.launch()

async function context(tz, viewport) {
  const ctx = await browser.newContext({ timezoneId: tz, viewport, locale: 'en-GB' })
  ctx.on('page', (p) => {
    p.on('console', (m) => m.type() === 'error' && errors.push(`[${tz}] ${m.text()}`))
    p.on('pageerror', (e) => errors.push(`[${tz}] pageerror ${e.message}`))
    p.on('dialog', (d) => d.accept())
  })
  return ctx
}
async function signIn(ctx, email, name) {
  const page = await ctx.newPage()
  await page.goto(BASE + '/login')
  // Signs in through the emulator's documented fake-credential path (see src/firebase.ts), not its popup.
  await page.waitForFunction(() => '__e2eSignIn' in window)
  await page.evaluate(([e, n]) => window.__e2eSignIn(e, n), [email, name])
  await page.waitForURL(BASE + '/')
  return page
}
async function uidOf(email) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-tutor-booking/accounts:query', {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: '{}',
  }).then((r) => r.json())
  return r.userInfo.find((u) => u.email === email).localId
}
const shot = async (page, name) => (await page.waitForTimeout(500), page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }))
const step = (s) => console.log('·', s)

process.on('uncaughtException', async (e) => {
  console.log('FAILED:', e.message.split('\n')[0])
  for (const c of browser.contexts()) for (const [i, p] of c.pages().entries()) await p.screenshot({ path: `${SHOTS}/fail-${i}-${Date.now()}.png`, fullPage: true }).catch(() => {})
  console.log(errors.join('\n') || 'no console errors')
  process.exit(1)
})
const tutorCtx = await context('America/Santiago', { width: 1100, height: 900 })
const studentCtx = await context('Europe/Madrid', { width: 420, height: 900 })

step('tutor signs in and is made admin')
const tutor = await signIn(tutorCtx, 'tess@example.com', 'Tess Tutor')
const tutorUid = await uidOf('tess@example.com')
await fetch(`${FS}/admins/${tutorUid}`, {
  method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { email: { stringValue: 'tess@example.com' } } }),
})
await tutor.reload()
await tutor.waitForSelector('h1:has-text("Dashboard")')

step('tutor confirms timezone in Settings and opens 14:00–17:00 Santiago, 10 days out')
await tutor.goto(BASE + '/admin/availability')
await tutor.click('a:has-text("Confirm it in Settings")')
await tutor.waitForURL(BASE + '/settings')
await tutor.click('button:has-text("Confirm")')
await tutor.waitForSelector('text=Not saved yet', { state: 'detached' })
await shot(tutor, '00-tutor-settings')
await tutor.goto(BASE + '/admin/availability')
// Always a future day (10 days out), so the test doesn't expire.
const slotDay = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
await tutor.fill('input[type=date]', slotDay)
await tutor.fill('input[type=time] >> nth=0', '14:00')
await tutor.fill('input[type=time] >> nth=1', '17:00')
await tutor.click('button:has-text("Add 3 slots")')
await tutor.waitForSelector('text=Added 3 slot(s)')
await shot(tutor, '01-tutor-availability')

step('student signs in, books with a goal')
const student = await signIn(studentCtx, 'sam@example.com', 'Sam Student')
await shot(student, '02-student-dashboard-empty')
await student.goto(BASE + '/book')
await student.waitForSelector('.chip')
console.log('  student chips:', await student.locator('.chip').allInnerTexts())
await student.fill('input[placeholder^="e.g. Who were"]', "Who were Maria Silva's parents?")
await student.click('.chip >> nth=0')
await student.click('.chip >> nth=1')
await shot(student, '03-student-book')
await student.click('button:has-text("Request")')
await student.waitForURL(BASE + '/')

step('tutor confirms the first option')
await tutor.goto(BASE + '/admin/requests')
await tutor.waitForSelector('button:has-text("Confirm this")')
await shot(tutor, '04-tutor-requests')
await tutor.click('button:has-text("Confirm this") >> nth=0')
await tutor.waitForSelector('text=No requests waiting')

step('tutor works the session: tasks, note, payment')
await tutor.goto(BASE + '/admin/sessions')
await tutor.click('a.card >> nth=0')
await tutor.waitForSelector('text=Add to checklist')
await tutor.click('summary:has-text("Add to checklist")')
for (const t of ['Send a scan of the birth certificate', 'Ask Uncle José about the village', 'List the godparents you know']) {
  await tutor.fill('input[placeholder^="e.g. Send a scan"]', t)
  await tutor.click('button:text-is("Add")')
  await tutor.waitForSelector(`.task-list >> text=${t}`)
}
await tutor.click('button:has-text("Mark complete") >> nth=0')
await tutor.waitForSelector('text=33%')
await tutor.fill('textarea[placeholder^="Questions"]', 'The parish records for 1890–1910 are online, checking them this week.')
await tutor.click('button:has-text("Post note")')
await tutor.waitForSelector('.note >> text=parish records')
await tutor.click('button:has-text("Mark paid")')
await tutor.waitForSelector('button:has-text("Mark unpaid")')
const sessionUrl = tutor.url()
await shot(tutor, '05-tutor-session')

step('student sees progress and replies in the notes')
await student.goto(BASE + '/')
await student.waitForSelector('text=33%')
await shot(student, '06-student-dashboard')
await student.goto(sessionUrl)
await student.waitForSelector('.note')
console.log('  student session header:', (await student.locator('section.card >> nth=0').innerText()).replace(/\n/g, ' | '))
console.log('  student sees Mark complete buttons:', await student.locator('button:has-text("Mark complete")').count())
await student.fill('textarea[placeholder^="Questions"]', 'Will do, thanks!')
await student.click('button:has-text("Post note")')
await student.waitForSelector('.note >> text=Will do')
await shot(student, '07-student-session')

step('tutor dashboard and student page')
await tutor.goto(BASE + '/')
await tutor.waitForSelector('a.card[href^="/admin/students/"]')
await shot(tutor, '08-tutor-dashboard')
await tutor.click('a.card[href^="/admin/students/"]')
await tutor.waitForSelector('h1:has-text("Sam Student")')
await shot(tutor, '09-tutor-student')

step('both themes, and the theme toggle')
for (const [page, name] of [[student, 'student'], [tutor, 'tutor']]) {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(BASE + '/')
  await page.waitForSelector('.progress, .stat')
  await shot(page, `10-${name}-dashboard-dark`)
  await page.goto(sessionUrl)
  await page.waitForSelector('.note')
  await shot(page, `11-${name}-session-dark`)
}
// No saved choice yet, so the dark device setting applies; each click then flips and saves.
const themes = [await student.evaluate(() => document.documentElement.dataset.theme)]
for (let i = 0; i < 2; i++) {
  await student.click('button[aria-label^="Theme"]')
  themes.push(await student.evaluate(() => document.documentElement.dataset.theme))
}
console.log('  theme toggle cycles:', themes.join(' → '))
await student.click('button[aria-label^="Theme"]') // → light
await student.reload()
console.log('  light choice kept after reload:', await student.evaluate(() => document.documentElement.dataset.theme))

step('both switch to Spanish')
await student.emulateMedia({ colorScheme: 'light' })
await tutor.emulateMedia({ colorScheme: 'light' })
for (const page of [student, tutor]) {
  await page.goto(BASE + '/')
  await page.click('button[aria-label="Cambiar a español"]')
  await page.waitForFunction(() => document.documentElement.lang === 'es')
}
await student.waitForSelector('h1:has-text("Hola, Sam")')
console.log('  student nav:', (await student.locator('nav.lanes').innerText()).replace(/\n/g, ' | '))
console.log('  student next session:', (await student.locator('a.card:has-text("Próxima sesión")').innerText()).replace(/\n/g, ' | '))
await shot(student, '12-student-dashboard-es')
await student.goto(sessionUrl)
await student.waitForSelector('h2:has-text("Hallazgos"), h2:has-text("Tareas")')
await shot(student, '13-student-session-es')
await tutor.waitForSelector('h1:has-text("Panel")')
await shot(tutor, '14-tutor-dashboard-es')
await tutor.goto(BASE + '/admin/availability')
await tutor.waitForSelector('h1:has-text("Disponibilidad")')
await shot(tutor, '15-tutor-availability-es')
await student.reload()
console.log('  Spanish kept after reload:', await student.evaluate(() => document.documentElement.lang))
await student.click('button[aria-label="Switch to English"]')
await student.waitForFunction(() => document.documentElement.lang === 'en')
console.log('  and back to English:', await student.locator('h2').first().innerText())

step('student pins a timezone and a language in Settings, then follows the device again')
await student.click('a[aria-label="Settings"]')
await student.waitForSelector('h1:has-text("Settings")')
await student.click('[role=combobox]')
await student.keyboard.type('santi')
console.log('  timezone search "santi":', await student.locator('[role=option] strong').allInnerTexts())
await student.keyboard.type('ago chile')
await student.keyboard.press('Enter')
console.log('  picked:', await student.inputValue('[role=combobox]'))
await student.click('button:has-text("Save")')
await student.waitForSelector('text=Use device time')
await shot(student, '16-student-settings')
await student.goto(BASE + '/sessions')
console.log('  sessions page zone line:', await student.locator('.tz-note').innerText())
await student.goto(BASE + '/settings')
await student.click('button:has-text("Español")')
await student.waitForFunction(() => document.documentElement.lang === 'es')
await student.click('button:has-text("Usar la hora del dispositivo")')
await student.waitForSelector('text=Siguiendo a este dispositivo')
await student.click('button:has-text("English")')
await student.waitForFunction(() => document.documentElement.lang === 'en')

step('student continues the case with a follow-up session; the researcher sees it as one')
await student.goto(sessionUrl)
await student.click('a:has-text("Book a follow-up session")')
await student.waitForSelector('.chip')
console.log('  book page preselects:', await student.locator('.segmented button.on').innerText(), '·', await student.locator('select >> nth=0').evaluate((s) => s.selectedOptions[0].text))
console.log('  question prefilled:', await student.inputValue('input[maxlength="120"]'))
await student.click('.chip:not([disabled]) >> nth=0')
await shot(student, '17-student-follow-up')
await student.click('button:has-text("Request")')
await student.waitForURL(BASE + '/')
await tutor.goto(BASE + '/admin/requests')
await tutor.waitForSelector('.badge.warn') // the tutor is still in Spanish here
console.log('  request shows:', (await tutor.locator('p:has(.badge.warn)').innerText()).replace(/\s+/g, ' '))
await shot(tutor, '18-tutor-follow-up-request')
await student.goto(sessionUrl)
await student.waitForSelector('.case-list li >> nth=1')
console.log('  case on the first session:', (await student.locator('.case-list').innerText()).replace(/\n/g, ' | '))
await shot(student, '19-student-case')

await browser.close()
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors')
