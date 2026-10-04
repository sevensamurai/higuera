import { reactive, readonly } from 'vue'
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth'
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, type DocumentSnapshot } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { browserTimeZone, isValidTimeZone } from './timezone'
import { hasDeviceChoice, isLocale, locale, setLocale, t, type Locale } from './i18n'

const state = reactive({
  user: null as User | null,
  isAdmin: false,
  ready: false,
  /** Zone the user picked explicitly; null means "follow this device". */
  chosenTimeZone: null as string | null,
})

let resolveReady: () => void
const ready = new Promise<void>((r) => (resolveReady = r))

// What we last learned about an account, kept on this device. Signing in needs the network but opening
// the installed app does not, and the role and zone come from Firestore reads that wait on the server.
interface Known {
  isAdmin: boolean
  timeZone: string | null
}
const knownKey = (uid: string) => `account:${uid}`
function recall(uid: string): Known | null {
  try {
    const v = JSON.parse(localStorage.getItem(knownKey(uid)) ?? 'null')
    return v && typeof v.isAdmin === 'boolean' ? { isAdmin: v.isAdmin, timeZone: isValidTimeZone(v.timeZone) ? v.timeZone : null } : null
  } catch {
    return null
  }
}
function remember(uid: string, k: Known) {
  try {
    localStorage.setItem(knownKey(uid), JSON.stringify(k))
  } catch {
    /* storage unavailable: the next offline start falls back to the client view */
  }
}

// How long the server gets to answer before the page opens on what the device already knows.
const SERVER_WAIT_MS = 3500

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    Object.assign(state, { user: null, isAdmin: false, chosenTimeZone: null, ready: true })
    resolveReady()
    return
  }
  const ref = doc(db, 'users', user.uid)
  // Writes finish only once the server has them, so nothing here may wait on one: offline, that is never.
  setDoc(
    ref,
    {
      displayName: user.displayName ?? user.email ?? t('common.unnamed'),
      email: user.email,
      photoURL: user.photoURL ?? null,
      // Lets the tutor see a student's local time even if they never pick a zone.
      detectedTimeZone: browserTimeZone,
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  ).catch((e) => console.error('Profile sync failed', e))

  // Applies what the server says: the role and zone, and the language (a choice made on this device
  // wins and is recorded on the account; otherwise the account's applies; a first sign-in records
  // whatever this device is showing).
  const settle = (profile: DocumentSnapshot, admin: DocumentSnapshot): Known => {
    const chosen = profile.data()?.timeZone
    const known = { isAdmin: admin.exists(), timeZone: isValidTimeZone(chosen) ? (chosen as string) : null }
    remember(user.uid, known)
    const saved = profile.data()?.locale
    if (!hasDeviceChoice() && isLocale(saved)) setLocale(saved, false)
    else if (saved !== locale.value) updateDoc(ref, { locale: locale.value }).catch((e) => console.error('Saving language failed', e))
    return known
  }

  const fromServer = Promise.all([getDoc(ref), getDoc(doc(db, 'admins', user.uid))]).catch((e) => {
    console.error('Profile read failed', e)
    return null
  })
  const slow = new Promise<null>((r) => setTimeout(r, navigator.onLine ? SERVER_WAIT_MS : 0))
  const first = await Promise.race([fromServer, slow])

  // The user is published together with their role, once both are known: publishing the user first
  // showed an admin the client dashboard for a moment while the admin check was still in flight.
  const known = (first && settle(...first)) || recall(user.uid) || { isAdmin: false, timeZone: null }
  Object.assign(state, { user, isAdmin: known.isAdmin, chosenTimeZone: known.timeZone, ready: true })
  resolveReady()

  if (!first) {
    // No answer in time (offline, or a poor connection): the page is already open on what this device
    // knew. Take the server's answer when it comes, if this is still the signed-in account.
    const late = await fromServer
    if (late && state.user?.uid === user.uid) {
      const k = settle(...late)
      Object.assign(state, { isAdmin: k.isAdmin, chosenTimeZone: k.timeZone })
    }
  }
})

export const useAuth = () => readonly(state)
export const authReady = () => ready

export async function signIn() {
  await signInWithPopup(auth, googleProvider)
}

export async function signOut() {
  await fbSignOut(auth)
}

/** Pins the user's display zone, or pass null to follow the device again. */
export async function setMyTimeZone(tz: string | null) {
  if (!state.user) return
  await updateDoc(doc(db, 'users', state.user.uid), { timeZone: tz ?? deleteField() })
  state.chosenTimeZone = tz
}

/** Switch language here and remember it on the account, so other devices (and future emails) follow. */
export async function saveMyLocale(l: Locale) {
  setLocale(l)
  if (state.user) await updateDoc(doc(db, 'users', state.user.uid), { locale: l })
}
