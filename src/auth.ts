import { reactive, readonly } from 'vue'
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth'
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
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

onAuthStateChanged(auth, async (user) => {
  // The user is published together with their role, once both are known: publishing the user first
  // showed an admin the client dashboard for a moment while the admin check was still in flight.
  let isAdmin = false
  let chosenTimeZone: string | null = null
  let afterwards: Promise<unknown> | undefined
  if (user) {
    try {
      const ref = doc(db, 'users', user.uid)
      // Mirror the profile (so the admin can pick this user when assigning tasks) while reading it
      // and the admin record; none of the three depends on another.
      const [, profile, admin] = await Promise.all([
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
        ),
        getDoc(ref),
        getDoc(doc(db, 'admins', user.uid)),
      ])
      const chosen = profile.data()?.timeZone
      chosenTimeZone = isValidTimeZone(chosen) ? chosen : null
      isAdmin = admin.exists()
      // Language: a choice made on this device wins and is recorded on the account; otherwise the
      // account's saved language applies; a first sign-in records whatever this device is showing.
      const saved = profile.data()?.locale
      if (!hasDeviceChoice() && isLocale(saved)) setLocale(saved, false)
      else if (saved !== locale.value) afterwards = updateDoc(ref, { locale: locale.value })
    } catch (e) {
      console.error('Profile sync failed', e)
    }
  }
  Object.assign(state, { user, isAdmin, chosenTimeZone, ready: true })
  resolveReady()
  afterwards?.catch((e) => console.error('Saving language failed', e))
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
