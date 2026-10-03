import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Task } from '@/types'
import { toDate, toDateOrNow, type Unsubscribe } from './util'

const col = collection(db, 'tasks')

function fromDoc(d: DocumentSnapshot): Task {
  const x = d.data()!
  return {
    id: d.id,
    userId: x.userId,
    userName: x.userName,
    title: x.title,
    details: x.details ?? '',
    dueDate: typeof x.dueDate === 'string' ? x.dueDate : undefined,
    status: x.status,
    bookingId: x.bookingId,
    createdAt: toDateOrNow(x.createdAt),
    completedAt: toDate(x.completedAt),
  }
}

export function watchMyTasks(uid: string, cb: (t: Task[]) => void): Unsubscribe {
  return onSnapshot(query(col, where('userId', '==', uid)), (snap) =>
    cb(snap.docs.map(fromDoc).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
  )
}

/** Tasks assigned within one session. Filtering on userId too keeps the query inside the student's read rule. */
export function watchSessionTasks(bookingId: string, userId: string, cb: (t: Task[]) => void): Unsubscribe {
  return onSnapshot(query(col, where('bookingId', '==', bookingId), where('userId', '==', userId)), (snap) =>
    cb(snap.docs.map(fromDoc).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())),
  )
}

export function watchAllTasks(cb: (t: Task[]) => void): Unsubscribe {
  return onSnapshot(query(col, orderBy('createdAt', 'desc')), (snap) => cb(snap.docs.map(fromDoc)))
}

export const createTask = (t: {
  userId: string
  userName: string
  title: string
  details: string
  dueDate?: string
  bookingId?: string
}) =>
  addDoc(col, {
    userId: t.userId,
    userName: t.userName,
    title: t.title.trim(),
    details: t.details.trim(),
    ...(t.dueDate ? { dueDate: t.dueDate } : {}),
    ...(t.bookingId ? { bookingId: t.bookingId } : {}),
    status: 'open',
    createdAt: serverTimestamp(),
  })

export const setTaskDone = (id: string, done: boolean) =>
  updateDoc(doc(col, id), {
    status: done ? 'done' : 'open',
    completedAt: done ? serverTimestamp() : deleteField(),
  })

export const deleteTask = (id: string) => deleteDoc(doc(col, id))
