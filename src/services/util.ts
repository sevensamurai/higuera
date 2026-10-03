import { Timestamp, type DocumentData } from 'firebase/firestore'
import type { SlotOption } from '@/types'

export const toDate = (v: unknown): Date | undefined => (v instanceof Timestamp ? v.toDate() : undefined)

/** serverTimestamp() reads back as null until the write is acknowledged; treat that as "now". */
export const toDateOrNow = (v: unknown): Date => toDate(v) ?? new Date()

export const optionFromDoc = (o: DocumentData): SlotOption => ({
  slotId: o.slotId,
  start: toDateOrNow(o.start),
  durationMin: o.durationMin,
})

export const optionToDoc = (o: SlotOption) => ({
  slotId: o.slotId,
  start: Timestamp.fromDate(o.start),
  durationMin: o.durationMin,
})

export type Unsubscribe = () => void
