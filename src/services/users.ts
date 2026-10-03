import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'
import type { UserProfile } from '@/types'
import type { Unsubscribe } from './util'

export function watchUsers(cb: (u: UserProfile[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'users'), (snap) =>
    cb(
      snap.docs
        .map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    ),
  )
}
