import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true'

// A `demo-` project id is emulator-only: it can never reach a real Firebase project.
const config = useEmulators
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-tutor-booking', appId: 'demo' }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

if (!config.projectId) {
  throw new Error('Firebase is not configured: copy .env.example to .env.local, or run `npm run dev:emu`.')
}

const app = initializeApp(config)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// Persistent cache: the installed PWA can show sessions and tasks offline, and repeat visits cost fewer reads.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (useEmulators) {
  // Same host the page was loaded from, so browsing from another device on the network (npm run dev:lan)
  // reaches the emulators on the dev machine rather than on the viewing device. `localhost` is mapped
  // to 127.0.0.1 because the emulators bind IPv4 only.
  const emuHost = location.hostname === 'localhost' ? '127.0.0.1' : location.hostname
  connectAuthEmulator(auth, `http://${emuHost}:9099`, { disableWarnings: true })
  // Test hook for the browser walk-through: the Auth emulator accepts an unsigned Google ID token, which
  // skips the emulator's popup (its relay to the page is flaky under automation). Emulator builds only:
  // in a production build this branch is constant-false and removed.
  Object.assign(window, {
    __e2eSignIn: (email: string, name: string) =>
      signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name }))),
  })
  connectFirestoreEmulator(db, emuHost, 8080)
}
