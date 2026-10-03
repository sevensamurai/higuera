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
  state.user = user
  state.isAdmin = false
  state.chosenTimeZone = null
  if (user) {
    try {
      // Mirror the profile so the admin can pick this user when assigning tasks.
      await setDoc(
        doc(db, 'users', user.uid),
        {
          displayName: user.displayName ?? user.email ?? t('common.unnamed'),
          email: user.email,
          photoURL: user.photoURL ?? null,
          // Lets the tutor see a student's local time even if they never pick a zone.
          detectedTimeZone: browserTimeZone,
          lastLoginAt: serverTimestamp(),
        },
        { merge: true },
      )
      const [profile, admin] = await Promise.all([
        getDoc(doc(db, 'users', user.uid)),
        getDoc(doc(db, 'admins', user.uid)),
      ])
      const chosen = profile.data()?.timeZone
      state.chosenTimeZone = isValidTimeZone(chosen) ? chosen : null
      state.isAdmin = admin.exists()
      // Language: a choice made on this device wins and is recorded on the account; otherwise the
      // account's saved language applies; a first sign-in records whatever this device is showing.
      const saved = profile.data()?.locale
      if (!hasDeviceChoice() && isLocale(saved)) setLocale(saved, false)
      else if (saved !== locale.value) await updateDoc(doc(db, 'users', user.uid), { locale: locale.value })
    } catch (e) {
      console.error('Profile sync failed', e)
    }
  }
  state.ready = true
  resolveReady()
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
