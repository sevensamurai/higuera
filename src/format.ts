import { dayIn } from './timezone'
import { intlLocale } from './i18n'

// Every formatter takes the zone explicitly: the same instant reads differently for tutor and student.
// The language comes from the UI's chosen locale (reactive, so templates re-render when it changes).
const cache = new Map<string, Intl.DateTimeFormat>()
function fmt(tz: string, opts: Intl.DateTimeFormatOptions) {
  const loc = intlLocale.value
  const key = loc + tz + JSON.stringify(opts)
  let f = cache.get(key)
  if (!f) cache.set(key, (f = new Intl.DateTimeFormat(loc, { ...opts, timeZone: tz })))
  return f
}

export const fmtDay = (d: Date, tz: string) => fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
// Spanish: always 24-hour (es-CL would otherwise give "07:00 p. m."); English keeps its regional habit.
export const fmtTime = (d: Date, tz: string) =>
  fmt(tz, { hour: '2-digit', minute: '2-digit', ...(intlLocale.value.startsWith('es') && { hourCycle: 'h23' }) }).format(d)
export const fmtDate = (d: Date, tz: string) => fmt(tz, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
export const fmtSlot = (d: Date, durationMin: number, tz: string) =>
  `${fmtDay(d, tz)} · ${fmtTime(d, tz)}–${fmtTime(new Date(d.getTime() + durationMin * 60_000), tz)}`

/** "GMT-3", "GMT+5:30" — offsets rather than abbreviations, which are ambiguous across countries. */
export const tzOffset = (tz: string, at: Date = new Date()) =>
  fmt(tz, { timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? tz

/** "Sao Paulo (GMT-3)" */
export const tzLabel = (tz: string, at: Date = new Date()) =>
  `${tz.split('/').pop()!.replace(/_/g, ' ')} (${tzOffset(tz, at)})`

/** Local calendar day key, for grouping slots by the viewer's day. */
export const dayKey = (d: Date, tz: string) => dayIn(d, tz)

/** A plain calendar date (yyyy-mm-dd) that means the same day for everyone, e.g. a due date. */
export const fmtCalendarDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return fmt('UTC', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d)))
}

