import {
  addDoc,
  collection,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { t } from '@/i18n'
import type { Booking, BookingKind, PaymentStatus, SlotOption } from '@/types'
import { optionFromDoc, optionToDoc, toDate, toDateOrNow, type Unsubscribe } from './util'

const col = collection(db, 'bookings')

function fromDoc(d: DocumentSnapshot): Booking {
  const x = d.data()!
  return {
    id: d.id,
    userId: x.userId,
    userName: x.userName,
    userEmail: x.userEmail,
    userTimeZone: x.userTimeZone,
    caseId: x.caseId,
    kind: x.kind,
    title: x.title ?? '',
    notes: x.notes ?? '',
    options: (x.options ?? []).map(optionFromDoc),
    status: x.status,
    confirmed: x.confirmed ? optionFromDoc(x.confirmed) : undefined,
    payment: x.payment,
    paymentNote: x.paymentNote,
    paidAt: toDate(x.paidAt),
    adminNote: x.adminNote,
    summary: x.summary,
    createdAt: toDateOrNow(x.createdAt),
  }
}

const byNewest = (a: Booking, b: Booking) => b.createdAt.getTime() - a.createdAt.getTime()

// ---- user lane ----

export async function requestBooking(input: {
  userId: string
  userName: string
  userEmail: string
  userTimeZone: string
  /** Set when this request continues an existing case. */
  caseId?: string
  kind: BookingKind
  title: string
  notes: string
  options: SlotOption[]
}) {
  if (input.options.length < 1 || input.options.length > 3) throw new Error(t('errors.options'))
  if (!input.title.trim()) throw new Error(t('errors.question'))
  await addDoc(col, {
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    userTimeZone: input.userTimeZone,
    ...(input.caseId ? { caseId: input.caseId } : {}),
    kind: input.kind,
    title: input.title.trim(),
    notes: input.notes.trim(),
    options: input.options.map(optionToDoc),
    status: 'pending',
    payment: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Sorted client-side so the query needs no composite index. */
export function watchMyBookings(uid: string, cb: (b: Booking[]) => void): Unsubscribe {
  return onSnapshot(query(col, where('userId', '==', uid)), (snap) => cb(snap.docs.map(fromDoc).sort(byNewest)))
}

/** One booking, live. Calls back with null if it doesn't exist or isn't readable. */
export function watchBooking(id: string, cb: (b: Booking | null) => void): Unsubscribe {
  return onSnapshot(
    doc(col, id),
    (s) => cb(s.exists() ? fromDoc(s) : null),
    () => cb(null),
  )
}

export const withdrawRequest = (id: string) =>
  updateDoc(doc(col, id), { status: 'cancelled', updatedAt: serverTimestamp() })

// ---- admin lane ----

export function watchAllBookings(cb: (b: Booking[]) => void): Unsubscribe {
  return onSnapshot(query(col, orderBy('createdAt', 'desc'), limit(300)), (snap) => cb(snap.docs.map(fromDoc)))
}

/** Confirms one of the requested options and marks its slot booked, atomically. */
export async function confirmBooking(bookingId: string, option: SlotOption) {
  await runTransaction(db, async (tx) => {
    const bRef = doc(col, bookingId)
    const sRef = doc(db, 'slots', option.slotId)
    const [b, s] = [await tx.get(bRef), await tx.get(sRef)]
    if (b.data()?.status !== 'pending') throw new Error(t('errors.notPending'))
    if (!s.exists() || s.data().status !== 'open') throw new Error(t('errors.slotTaken'))
    tx.update(sRef, { status: 'booked', bookingId })
    tx.update(bRef, { status: 'confirmed', confirmed: optionToDoc(option), updatedAt: serverTimestamp() })
  })
}

export const declineBooking = (id: string, adminNote: string) =>
  updateDoc(doc(col, id), { status: 'declined', adminNote: adminNote.trim(), updatedAt: serverTimestamp() })

/** Cancels a confirmed session and reopens its slot so someone else can take it. */
export async function cancelConfirmed(b: Booking, adminNote: string) {
  await runTransaction(db, async (tx) => {
    const sRef = b.confirmed ? doc(db, 'slots', b.confirmed.slotId) : null
    const s = sRef ? await tx.get(sRef) : null
    if (sRef && s?.exists() && s.data().bookingId === b.id) {
      tx.update(sRef, { status: 'open', bookingId: deleteField() })
    }
    tx.update(doc(col, b.id), { status: 'cancelled', adminNote: adminNote.trim(), updatedAt: serverTimestamp() })
  })
}

export const setPayment = (id: string, payment: PaymentStatus, paymentNote: string) =>
  updateDoc(doc(col, id), {
    payment,
    paymentNote: paymentNote.trim(),
    paidAt: payment === 'paid' ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp(),
  })

export const saveSummary = (id: string, summary: string, markCompleted: boolean) =>
  updateDoc(doc(col, id), {
    summary: summary.trim(),
    ...(markCompleted ? { status: 'completed' } : {}),
    updatedAt: serverTimestamp(),
  })

export const updateTitle = (id: string, title: string) =>
  updateDoc(doc(col, id), { title: title.trim(), updatedAt: serverTimestamp() })

export const reopenSession = (id: string) =>
  updateDoc(doc(col, id), { status: 'confirmed', updatedAt: serverTimestamp() })
