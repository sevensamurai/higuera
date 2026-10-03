// Timezone maths on top of Intl only (no date library).
// Instants are stored as UTC Timestamps; a timezone matters only when a wall-clock time is typed in
// (the tutor's availability) or shown (everyone's view). This module has no imports so tests can load it.

export const browserTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const partsFmt = new Map<string, Intl.DateTimeFormat>()

/** Wall-clock fields of instant `t` as read in `tz`. */
function wall(t: number, tz: string) {
  let f = partsFmt.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFmt.set(tz, f)
  }
  const p: Record<string, number> = {}
  for (const x of f.formatToParts(t)) if (x.type !== 'literal') p[x.type] = Number(x.value)
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** Offset of `tz` from UTC at instant `t`, in ms (São Paulo → -3h). */
export function offsetMs(t: number, tz: string): number {
  const w = wall(t, tz)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(t / 1000) * 1000
}

/**
 * The instant at which a clock in `tz` reads `date` (yyyy-mm-dd) `time` (HH:mm).
 * Across a DST change the offset differs either side, so both candidate offsets are tried.
 * In a spring-forward gap (a time that never happens) the later instant is used, i.e. just after the gap;
 * in a fall-back overlap (a time that happens twice) the first occurrence is used.
 */
export function zonedToDate(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  const t1 = asUtc - offsetMs(asUtc, tz)
  const t2 = asUtc - offsetMs(t1, tz)
  const matches = (t: number) => {
    const w = wall(t, tz)
    return w.year === y && w.month === mo && w.day === d && w.hour === h && w.minute === mi
  }
  const hits = [t1, t2].filter(matches).sort((a, b) => a - b)
  return new Date(hits.length ? hits[0] : Math.max(t1, t2))
}

/** Calendar day (yyyy-mm-dd) of instant `d` as seen in `tz`. */
export function dayIn(d: Date, tz: string): string {
  const w = wall(d.getTime(), tz)
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`
}

/** All IANA zones the runtime knows, sorted west → east by their current offset. */
export function allTimeZones(now = Date.now()): string[] {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [browserTimeZone]
  if (!zones.includes(browserTimeZone)) zones.push(browserTimeZone)
  return zones
    .map((tz) => ({ tz, off: offsetMs(now, tz) }))
    .sort((a, b) => a.off - b.off || a.tz.localeCompare(b.tz))
    .map((x) => x.tz)
}
