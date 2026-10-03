import type { Booking, Task, UserProfile } from './types'
import { t } from './i18n'

// Progress is measured by assigned tasks: the share the tutor has marked complete.
export interface Progress {
  done: number
  total: number
  /** 0–100, or null when nothing has been assigned yet (no progress to measure, not 0%). */
  pct: number | null
}

export function taskProgress(tasks: Task[]): Progress {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  return { done, total, pct: total ? Math.round((done / total) * 100) : null }
}

export const isSession = (b: Booking) => (b.status === 'confirmed' || b.status === 'completed') && !!b.confirmed
export const isUpcoming = (b: Booking, now = Date.now()) =>
  b.status === 'confirmed' && !!b.confirmed && b.confirmed.start.getTime() > now
export const byStart = (a: Booking, b: Booking) => a.confirmed!.start.getTime() - b.confirmed!.start.getTime()

export const sessionTitle = (b: Booking) => b.title || t(`kind.${b.kind}`)

// ---- cases: one research question over several sessions ----

/** The case a booking belongs to, named by the case's first booking. */
export const caseKey = (b: Booking) => b.caseId ?? b.id
const isClosed = (b: Booking) => b.status === 'declined' || b.status === 'cancelled'
const byCreated = (a: Booking, b: Booking) => a.createdAt.getTime() - b.createdAt.getTime()

/** The live (not declined or cancelled) bookings in `b`'s case, in the order they were requested. */
export function caseBookings(all: Booking[], b: Booking): Booking[] {
  const k = caseKey(b)
  return all.filter((x) => caseKey(x) === k && !isClosed(x)).sort(byCreated)
}

/** "Session n of total" for a booking whose case has more than one session; null otherwise. */
export function casePosition(all: Booking[], b: Booking): { n: number; total: number } | null {
  const list = caseBookings(all, b)
  const n = list.findIndex((x) => x.id === b.id) + 1
  return n && list.length > 1 ? { n, total: list.length } : null
}

export interface CaseSummary {
  id: string
  title: string
  sessions: number
}

/** Cases a client can book a follow-up in: those with at least one confirmed or completed session. Latest first. */
export function continuableCases(all: Booking[]): CaseSummary[] {
  const groups = new Map<string, Booking[]>()
  for (const b of [...all].sort(byCreated)) {
    if (isClosed(b)) continue
    const k = caseKey(b)
    groups.set(k, [...(groups.get(k) ?? []), b])
  }
  return [...groups.entries()]
    .filter(([, bs]) => bs.some(isSession))
    .map(([id, bs]) => {
      const first = bs.find((b) => b.id === id) ?? bs[0]
      return { id, title: first.title, sessions: bs.length, last: bs[bs.length - 1].createdAt.getTime() }
    })
    .sort((a, b) => b.last - a.last)
    .map(({ last: _, ...c }) => c)
}

export interface StudentSummary {
  user: UserProfile
  progress: Progress
  sessionsDone: number
  upcoming: number
  pending: number
  unpaid: number
  next?: Booking
  lastSession?: Booking
}

/** One row per student for the tutor's dashboard, most active first. */
export function summarizeStudents(users: UserProfile[], bookings: Booking[], tasks: Task[]): StudentSummary[] {
  const now = Date.now()
  return users
    .map((user) => {
      const bs = bookings.filter((b) => b.userId === user.uid)
      const sessions = bs.filter(isSession).sort(byStart)
      const past = sessions.filter((b) => b.status === 'completed' || b.confirmed!.start.getTime() <= now)
      const future = sessions.filter((b) => isUpcoming(b, now))
      return {
        user,
        progress: taskProgress(tasks.filter((t) => t.userId === user.uid)),
        sessionsDone: past.length,
        upcoming: future.length,
        pending: bs.filter((b) => b.status === 'pending').length,
        unpaid: sessions.filter((b) => b.payment === 'pending').length,
        next: future[0],
        lastSession: past[past.length - 1],
      }
    })
    .sort(
      (a, b) =>
        b.upcoming + b.pending + b.sessionsDone - (a.upcoming + a.pending + a.sessionsDone) ||
        a.user.displayName.localeCompare(b.user.displayName),
    )
}
