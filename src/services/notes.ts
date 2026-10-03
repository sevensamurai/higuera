import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import type { SessionNote } from '@/types'
import { toDateOrNow, type Unsubscribe } from './util'

// bookings/{id}/notes: a short thread per session, readable by the tutor and that session's student.
const notesOf = (bookingId: string) => collection(db, 'bookings', bookingId, 'notes')

export function watchNotes(bookingId: string, cb: (n: SessionNote[]) => void): Unsubscribe {
  return onSnapshot(query(notesOf(bookingId), orderBy('createdAt')), (snap) =>
    cb(
      snap.docs.map((d) => {
        const x = d.data()
        return {
          id: d.id,
          authorId: x.authorId,
          authorName: x.authorName,
          role: x.role,
          text: x.text,
          createdAt: toDateOrNow(x.createdAt),
        }
      }),
    ),
  )
}

export const addNote = (
  bookingId: string,
  n: { authorId: string; authorName: string; role: SessionNote['role']; text: string },
) =>
  addDoc(notesOf(bookingId), {
    authorId: n.authorId,
    authorName: n.authorName,
    role: n.role,
    text: n.text.trim(),
    createdAt: serverTimestamp(),
  })

export const deleteNote = (bookingId: string, noteId: string) => deleteDoc(doc(notesOf(bookingId), noteId))
