import { onScopeDispose, ref, type Ref } from 'vue'
import type { Unsubscribe } from './services/util'

/** Binds a Firestore listener to a ref for the lifetime of the calling component. */
export function useLive<T>(initial: T, subscribe: (set: (v: T) => void) => Unsubscribe) {
  const value = ref(initial) as Ref<T>
  const loaded = ref(false)
  const stop = subscribe((v) => {
    value.value = v
    loaded.value = true
  })
  onScopeDispose(stop)
  return { value, loaded }
}
