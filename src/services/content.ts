import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import type { Overview, OverviewDoc } from '@/types'
import type { Unsubscribe } from './util'

const ref = doc(db, 'content', 'overview')

/** Reads the bilingual doc; a pre-i18n doc ({title, body}) is treated as written in both languages. */
export function watchOverview(cb: (o: OverviewDoc) => void): Unsubscribe {
  return onSnapshot(
    ref,
    (s) => {
      const d = s.data()
      if (!d) return cb({})
      if (typeof d.title === 'string') return cb({ es: d as Overview, en: d as Overview })
      cb({ es: d.es, en: d.en })
    },
    () => cb({}),
  )
}

const clean = (o?: Overview) => (o && (o.title.trim() || o.body.trim()) ? { title: o.title.trim(), body: o.body.trim() } : null)

export const saveOverview = (o: OverviewDoc) => setDoc(ref, { es: clean(o.es), en: clean(o.en) })
