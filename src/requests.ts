import type { Booking, Slot, SlotOption } from './types'

// How the researcher's Requests page sees pending requests: per requested time, who wants it and who
// should get it. Pure (no Firebase, no i18n) so tests/requests.test.ts can load it.

export type OptionState = 'open' | 'taken' | 'removed' | 'past'

/** Whether an option can still be confirmed, given the live slots. */
export function optionState(o: SlotOption, slots: Map<string, Slot>, now = Date.now()): OptionState {
  if (o.start.getTime() <= now) return 'past'
  const s = slots.get(o.slotId)
  if (!s) return 'removed'
  return s.status === 'open' ? 'open' : 'taken'
}

export interface Contender {
  booking: Booking
  option: SlotOption
  /** The request's other times that are still open. None means this is their only chance. */
  alternatives: SlotOption[]
  /** The one to confirm when several want this time: no other option first, then first to ask. */
  suggested: boolean
}

export interface RequestedTime {
  slotId: string
  start: Date
  durationMin: number
  /** Suggested first, then in priority order. */
  contenders: Contender[]
}

export interface RequestPlan {
  /** Every open time someone asked for, earliest first. */
  times: RequestedTime[]
  /** Pending requests none of whose times can be confirmed any more. */
  stranded: Booking[]
}

export function planRequests(pending: Booking[], slots: Slot[], now = Date.now()): RequestPlan {
  const bySlot = new Map(slots.map((s) => [s.id, s]))
  const openOf = new Map(pending.map((b) => [b.id, b.options.filter((o) => optionState(o, bySlot, now) === 'open')]))

  const times = new Map<string, RequestedTime>()
  for (const b of pending) {
    for (const o of openOf.get(b.id)!) {
      if (!times.has(o.slotId)) times.set(o.slotId, { slotId: o.slotId, start: o.start, durationMin: o.durationMin, contenders: [] })
      const alternatives = openOf.get(b.id)!.filter((x) => x.slotId !== o.slotId)
      times.get(o.slotId)!.contenders.push({ booking: b, option: o, alternatives, suggested: false })
    }
  }
  for (const t of times.values()) {
    t.contenders.sort(
      (a, b) =>
        Number(a.alternatives.length > 0) - Number(b.alternatives.length > 0) ||
        a.booking.createdAt.getTime() - b.booking.createdAt.getTime(),
    )
    if (t.contenders.length > 1) t.contenders[0].suggested = true
  }
  return {
    times: [...times.values()].sort((a, b) => a.start.getTime() - b.start.getTime()),
    stranded: pending.filter((b) => openOf.get(b.id)!.length === 0),
  }
}
