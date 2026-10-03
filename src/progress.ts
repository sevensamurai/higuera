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
