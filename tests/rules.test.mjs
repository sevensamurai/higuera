// Firestore rules tests. Run with `npm run test:rules` (needs Java 21+ for the emulator).
import { after, before, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp,
  updateDoc, where, writeBatch,
} from 'firebase/firestore'

let env
const ALICE = { uid: 'alice', email: 'alice@example.com' }
const BOB = { uid: 'bob', email: 'bob@example.com' }
const ADMIN = { uid: 'tutor', email: 'tutor@example.com' }

const db = (who) => (who ? env.authenticatedContext(who.uid, { email: who.email }) : env.unauthenticatedContext()).firestore()
const option = (n) => ({ slotId: `s${n}`, start: Timestamp.fromDate(new Date(Date.now() + n * 3_600_000)), durationMin: 60 })
const booking = (over = {}) => ({
  userId: ALICE.uid, userName: 'Alice', userEmail: ALICE.email, kind: 'tutoring', title: 'Midterm prep', notes: '',
  options: [option(1), option(2)], status: 'pending', payment: 'pending',
  createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...over,
})

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-tutor-booking',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
after(() => env.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'admins', ADMIN.uid), { email: ADMIN.email })
    await setDoc(doc(d, 'bookings', 'a1'), booking())
    await setDoc(doc(d, 'bookings', 'b1'), booking({ userId: BOB.uid, userEmail: BOB.email }))
    await setDoc(doc(d, 'bookings', 'a-confirmed'), booking({ status: 'confirmed', confirmed: option(1) }))
    await setDoc(doc(d, 'tasks', 't1'), { userId: ALICE.uid, bookingId: 'a-confirmed', title: 'Read ch. 1', status: 'open' })
    await setDoc(doc(d, 'bookings', 'a-confirmed', 'notes', 'n-bob'), { authorId: BOB.uid, role: 'student', text: 'x' })
    await setDoc(doc(d, 'bookings', 'a-confirmed', 'notes', 'n-alice'), { authorId: ALICE.uid, role: 'student', text: 'hi' })
    await setDoc(doc(d, 'slots', 's1'), { start: option(1).start, durationMin: 60, status: 'open' })
  })
})

describe('content & profiles', () => {
  test('anyone reads the overview; only admin writes it', async () => {
    await assertSucceeds(getDoc(doc(db(null), 'content', 'overview')))
    await assertFails(setDoc(doc(db(ALICE), 'content', 'overview'), { title: 'x', body: 'y' }))
    await assertSucceeds(setDoc(doc(db(ADMIN), 'content', 'overview'), { title: 'x', body: 'y' }))
  })
  test('users write only their own profile, with their own email and no extra fields', async () => {
    const p = { displayName: 'Alice', email: ALICE.email, photoURL: null, lastLoginAt: Timestamp.now() }
    await assertSucceeds(setDoc(doc(db(ALICE), 'users', ALICE.uid), p))
    await assertFails(setDoc(doc(db(ALICE), 'users', BOB.uid), p))
    await assertFails(setDoc(doc(db(ALICE), 'users', ALICE.uid), { ...p, email: 'tutor@example.com' }))
    await assertFails(setDoc(doc(db(ALICE), 'users', ALICE.uid), { ...p, role: 'admin' }))
  })
  test('users may store a timezone, as a string', async () => {
    const p = { displayName: 'Alice', email: ALICE.email, detectedTimeZone: 'Europe/Lisbon' }
    await assertSucceeds(setDoc(doc(db(ALICE), 'users', ALICE.uid), p))
    await assertSucceeds(updateDoc(doc(db(ALICE), 'users', ALICE.uid), { timeZone: 'America/Sao_Paulo' }))
    await assertSucceeds(updateDoc(doc(db(ALICE), 'users', ALICE.uid), { timeZone: deleteField() }))
    await assertFails(updateDoc(doc(db(ALICE), 'users', ALICE.uid), { timeZone: 42 }))
  })
  test('users may store their language, es or en only', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'users', ALICE.uid), { displayName: 'Alice', email: ALICE.email, locale: 'es' }))
    await assertSucceeds(updateDoc(doc(db(ALICE), 'users', ALICE.uid), { locale: 'en' }))
    await assertFails(updateDoc(doc(db(ALICE), 'users', ALICE.uid), { locale: 'fr' }))
  })
  test('nobody can grant themselves admin', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'admins', ALICE.uid), { email: ALICE.email }))
    await assertSucceeds(getDoc(doc(db(ALICE), 'admins', ALICE.uid)))
    await assertFails(getDoc(doc(db(ALICE), 'admins', ADMIN.uid)))
  })
})

describe('bookings', () => {
  test('a user can request 1–3 options for themselves', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'bookings', 'n1'), booking({ options: [option(1)] })))
    await assertSucceeds(setDoc(doc(db(ALICE), 'bookings', 'n3'), booking({ options: [option(1), option(2), option(3)] })))
    await assertSucceeds(setDoc(doc(db(ALICE), 'bookings', 'tz'), booking({ userTimeZone: 'Asia/Kolkata' })))
  })
  test('rejects bad requests', async () => {
    const a = db(ALICE)
    await assertFails(setDoc(doc(a, 'bookings', 'x0'), booking({ options: [] })))
    await assertFails(setDoc(doc(a, 'bookings', 'x4'), booking({ options: [option(1), option(2), option(3), option(4)] })))
    await assertFails(setDoc(doc(a, 'bookings', 'xb'), booking({ userId: BOB.uid })))
    await assertFails(setDoc(doc(a, 'bookings', 'xs'), booking({ status: 'confirmed' })))
    await assertFails(setDoc(doc(a, 'bookings', 'xp'), booking({ payment: 'paid' })))
    await assertFails(setDoc(doc(a, 'bookings', 'xc'), booking({ confirmed: option(1) })))
    await assertFails(setDoc(doc(a, 'bookings', 'xk'), booking({ kind: 'other' })))
    await assertFails(setDoc(doc(a, 'bookings', 'xz'), booking({ userTimeZone: { evil: true } })))
    await assertFails(setDoc(doc(a, 'bookings', 'xt'), booking({ title: '' })))
    await assertFails(setDoc(doc(a, 'bookings', 'xT'), booking({ title: 'x'.repeat(121) })))
    const { title: _, ...untitled } = booking()
    await assertFails(setDoc(doc(a, 'bookings', 'xu'), untitled))
    await assertFails(setDoc(doc(db(null), 'bookings', 'xa'), booking()))
  })
  test('a follow-up may continue only a case of the same user', async () => {
    await assertSucceeds(setDoc(doc(db(ALICE), 'bookings', 'f1'), booking({ kind: 'case', caseId: 'a-confirmed' })))
    await assertSucceeds(setDoc(doc(db(ALICE), 'bookings', 'f0'), booking({ kind: 'case' }))) // a case from before the app
    await assertFails(setDoc(doc(db(ALICE), 'bookings', 'f2'), booking({ caseId: 'b1' })))
    await assertFails(setDoc(doc(db(ALICE), 'bookings', 'f3'), booking({ caseId: 'no-such-booking' })))
    await assertFails(setDoc(doc(db(ALICE), 'bookings', 'f4'), booking({ caseId: 42 })))
  })
  test('users see only their own bookings', async () => {
    const a = db(ALICE)
    await assertSucceeds(getDoc(doc(a, 'bookings', 'a1')))
    await assertFails(getDoc(doc(a, 'bookings', 'b1')))
    await assertSucceeds(getDocs(query(collection(a, 'bookings'), where('userId', '==', ALICE.uid))))
    await assertFails(getDocs(collection(a, 'bookings')))
  })
  test('a user may only withdraw a pending request', async () => {
    const a = db(ALICE)
    await assertFails(updateDoc(doc(a, 'bookings', 'a1'), { payment: 'paid' }))
    await assertFails(updateDoc(doc(a, 'bookings', 'a1'), { status: 'confirmed' }))
    await assertFails(updateDoc(doc(a, 'bookings', 'a1'), { status: 'cancelled', notes: 'sneaky' }))
    await assertFails(updateDoc(doc(a, 'bookings', 'a-confirmed'), { status: 'cancelled', updatedAt: Timestamp.now() }))
    await assertFails(updateDoc(doc(db(BOB), 'bookings', 'a1'), { status: 'cancelled', updatedAt: Timestamp.now() }))
    await assertSucceeds(updateDoc(doc(a, 'bookings', 'a1'), { status: 'cancelled', updatedAt: Timestamp.now() }))
  })
  test('admin confirms (booking the slot in the same write), marks paid, and reads everything', async () => {
    const t = db(ADMIN)
    await assertSucceeds(getDocs(collection(t, 'bookings')))
    const confirm = writeBatch(t)
    confirm.update(doc(t, 'slots', 's1'), { status: 'booked', bookingId: 'a1' })
    confirm.update(doc(t, 'bookings', 'a1'), { status: 'confirmed', confirmed: option(1) })
    await assertSucceeds(confirm.commit())
    await assertSucceeds(updateDoc(doc(t, 'bookings', 'a1'), { payment: 'paid', paymentNote: 'cash' }))
  })
})

describe('no double booking', () => {
  const confirmBoth = (t, bookingId, slotId = 's1') => {
    const b = writeBatch(t)
    b.update(doc(t, 'slots', slotId), { status: 'booked', bookingId })
    b.update(doc(t, 'bookings', bookingId), { status: 'confirmed', confirmed: option(1) })
    return b.commit()
  }
  test('a request is confirmed only by claiming its open slot', async () => {
    const t = db(ADMIN)
    await assertFails(updateDoc(doc(t, 'bookings', 'a1'), { status: 'confirmed', confirmed: option(1) }))
    await assertFails(updateDoc(doc(t, 'slots', 's1'), { status: 'booked', bookingId: 'a1' }))
    await assertSucceeds(confirmBoth(t, 'a1'))
  })
  test('a booked slot cannot go to a second request, nor be deleted', async () => {
    const t = db(ADMIN)
    await assertSucceeds(confirmBoth(t, 'a1'))
    await assertFails(confirmBoth(t, 'b1'))
    await assertFails(updateDoc(doc(t, 'slots', 's1'), { bookingId: 'b1' }))
    await assertFails(deleteDoc(doc(t, 'slots', 's1')))
  })
  test('releasing a slot (cancel or undo) is allowed, and it can then be booked again', async () => {
    const t = db(ADMIN)
    await assertSucceeds(confirmBoth(t, 'a1'))
    const release = writeBatch(t)
    release.update(doc(t, 'slots', 's1'), { status: 'open', bookingId: deleteField() })
    release.update(doc(t, 'bookings', 'a1'), { status: 'pending', confirmed: deleteField() })
    await assertSucceeds(release.commit())
    await assertSucceeds(confirmBoth(t, 'b1'))
  })
  test('two confirmations racing for one slot: exactly one wins', async () => {
    // Mirrors confirmBooking in src/services/bookings.ts, from two devices at once.
    const confirm = (bookingId) => {
      const t = db(ADMIN)
      return runTransaction(t, async (tx) => {
        const s = await tx.get(doc(t, 'slots', 's1'))
        if (s.data().status !== 'open') throw new Error('slot taken')
        tx.update(doc(t, 'slots', 's1'), { status: 'booked', bookingId })
        tx.update(doc(t, 'bookings', bookingId), { status: 'confirmed', confirmed: option(1) })
      })
    }
    const results = await Promise.allSettled([confirm('a1'), confirm('b1')])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    let slot
    await env.withSecurityRulesDisabled(async (ctx) => (slot = (await getDoc(doc(ctx.firestore(), 'slots', 's1'))).data()))
    assert.equal(slot.status, 'booked')
    assert.equal(slot.bookingId, results[0].status === 'fulfilled' ? 'a1' : 'b1')
  })
})

describe('session notes', () => {
  const note = (who, role, text = 'Bring the past paper') =>
    ({ authorId: who.uid, authorName: who.uid, role, text, createdAt: serverTimestamp() })
  const notes = (who) => collection(db(who), 'bookings', 'a-confirmed', 'notes')

  test('the student and the tutor both post to the thread', async () => {
    await assertSucceeds(addDoc(notes(ALICE), note(ALICE, 'student')))
    await assertSucceeds(addDoc(notes(ADMIN), note(ADMIN, 'tutor')))
    await assertSucceeds(getDocs(notes(ALICE)))
  })
  test('nobody else reads or posts, and roles cannot be faked', async () => {
    await assertFails(getDocs(notes(BOB)))
    await assertFails(addDoc(notes(BOB), note(BOB, 'student')))
    await assertFails(addDoc(notes(ALICE), note(ALICE, 'tutor')))
    await assertFails(addDoc(notes(ALICE), { ...note(ALICE, 'student'), authorId: ADMIN.uid }))
    await assertFails(addDoc(notes(ALICE), note(ALICE, 'student', '')))
    await assertFails(addDoc(notes(ALICE), { ...note(ALICE, 'student'), createdAt: Timestamp.fromMillis(0) }))
  })
  test('notes are never edited; authors and the tutor may delete', async () => {
    await assertFails(updateDoc(doc(notes(ALICE), 'n-alice'), { text: 'changed' }))
    await assertFails(deleteDoc(doc(notes(ALICE), 'n-bob')))
    await assertSucceeds(deleteDoc(doc(notes(ALICE), 'n-alice')))
    await assertSucceeds(deleteDoc(doc(notes(ADMIN), 'n-bob')))
  })
})

describe('slots & tasks', () => {
  test('signed-in users read slots; only admin writes them', async () => {
    await assertFails(getDocs(collection(db(null), 'slots')))
    await assertSucceeds(getDocs(collection(db(ALICE), 'slots')))
    await assertFails(updateDoc(doc(db(ALICE), 'slots', 's1'), { status: 'booked' }))
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'slots', 's1'), { durationMin: 45 }))
    await assertSucceeds(setDoc(doc(db(ADMIN), 'slots', 's9'), { start: option(9).start, durationMin: 60, status: 'open' }))
    await assertFails(setDoc(doc(db(ADMIN), 'slots', 's8'), { start: option(8).start, durationMin: 60, status: 'booked' }))
    await assertSucceeds(deleteDoc(doc(db(ADMIN), 'slots', 's9')))
  })
  test('users read only their own tasks and cannot complete them', async () => {
    await assertSucceeds(getDoc(doc(db(ALICE), 'tasks', 't1')))
    // The session page's query: scoped to the booking and to the student.
    const tasks = collection(db(ALICE), 'tasks')
    await assertSucceeds(getDocs(query(tasks, where('bookingId', '==', 'a-confirmed'), where('userId', '==', ALICE.uid))))
    await assertFails(getDocs(query(tasks, where('bookingId', '==', 'a-confirmed'))))
    await assertFails(getDoc(doc(db(BOB), 'tasks', 't1')))
    await assertFails(updateDoc(doc(db(ALICE), 'tasks', 't1'), { status: 'done' }))
    await assertSucceeds(updateDoc(doc(db(ADMIN), 'tasks', 't1'), { status: 'done' }))
  })
})
