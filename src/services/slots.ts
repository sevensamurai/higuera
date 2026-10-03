import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Slot } from '@/types'
import { zonedToDate } from '@/timezone'
import { toDateOrNow, type Unsubscribe } from './util'

const col = collection(db, 'slots')

/** Upcoming slots (open and booked), soonest first. */
export function watchUpcomingSlots(cb: (s: Slot[]) => void): Unsubscribe {
  const q = query(col, where('start', '>=', Timestamp.now()), orderBy('start'))
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => {
        const x = d.data()
        return { id: d.id, start: toDateOrNow(x.start), durationMin: x.durationMin, status: x.status, bookingId: x.bookingId }
      }),
    ),
  )
}

/**
 * Splits an availability window into back-to-back slots, e.g. 14:00–17:00 at 60 min → 3 slots.
 * `date` is yyyy-mm-dd and times are HH:mm, read as a wall clock in `tz` (the tutor's zone),
 * not in whatever zone this browser is in.
 */
export function planSlots(date: string, from: string, to: string, durationMin: number, tz: string): Date[] {
  const start = zonedToDate(date, from, tz)
  const end = zonedToDate(date, to, tz)
  const out: Date[] = []
  for (let t = start.getTime(); t + durationMin * 60_000 <= end.getTime(); t += durationMin * 60_000) {
    out.push(new Date(t))
  }
  return out
}

export async function createSlots(starts: Date[], durationMin: number) {
  const batch = writeBatch(db)
  for (const s of starts) {
    batch.set(doc(col), { start: Timestamp.fromDate(s), durationMin, status: 'open' })
  }
  await batch.commit()
}

export const deleteSlot = (id: string) => deleteDoc(doc(col, id))
