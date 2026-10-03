import { computed, reactive } from 'vue'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth'
import { browserTimeZone, isValidTimeZone } from './timezone'

// The tutor's zone lives in content/settings (public read, admin write) so that availability typed
// as "Sat 14:00–18:00" means the tutor's 14:00 wherever the tutor's laptop happens to be.
const settings = reactive({ tutorTimeZone: browserTimeZone, tutorTimeZoneSet: false })

const settingsRef = doc(db, 'content', 'settings')
onSnapshot(
  settingsRef,
  (s) => {
    const tz = s.data()?.tutorTimeZone
    settings.tutorTimeZoneSet = isValidTimeZone(tz)
    settings.tutorTimeZone = settings.tutorTimeZoneSet ? tz : browserTimeZone
  },
  () => {},
)

export const saveTutorTimeZone = (tz: string) => setDoc(settingsRef, { tutorTimeZone: tz }, { merge: true })

/**
 * viewerTz: the zone this screen renders times in.
 * The admin always works in the tutor's zone; a student sees their chosen zone, else their device's.
 */
export function useZones() {
  const auth = useAuth()
  return {
    tutorTz: computed(() => settings.tutorTimeZone),
    tutorTzSet: computed(() => settings.tutorTimeZoneSet),
    viewerTz: computed(() => (auth.isAdmin ? settings.tutorTimeZone : auth.chosenTimeZone ?? browserTimeZone)),
    deviceTz: browserTimeZone,
  }
}
