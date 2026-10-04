// Unit tests for how pending requests are laid out for the researcher. Run with `npm run test:unit`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planRequests } from '../src/requests.ts'
import type { Booking, Slot } from '../src/types.ts'

const NOW = Date.UTC(2026, 9, 1)
const at = (h: number) => new Date(NOW + h * 3_600_000)
const slot = (id: string, h: number, status: Slot['status'] = 'open'): Slot => ({ id, start: at(h), durationMin: 60, status })
const req = (id: string, askedMin: number, ...opts: [string, number][]): Booking =>
  ({
    id, userId: id, userName: id, userEmail: `${id}@x`, kind: 'tutoring', title: id, notes: '', status: 'pending',
    payment: 'pending', createdAt: new Date(NOW - askedMin * 60_000),
    options: opts.map(([slotId, h]) => ({ slotId, start: at(h), durationMin: 60 })),
  }) as Booking

const slots = [slot('tue15', 24), slot('wed10', 48), slot('thu09', 72), slot('fri', 96, 'booked'), slot('old', -2)]

test('a contested time suggests whoever has no other option, even if they asked later', () => {
  const ana = req('ana', 120, ['tue15', 24], ['wed10', 48])
  const luis = req('luis', 60, ['tue15', 24])
  const plan = planRequests([ana, luis], slots, NOW)
  const tue = plan.times.find((t) => t.slotId === 'tue15')!
  assert.deepEqual(tue.contenders.map((c) => [c.booking.id, c.suggested]), [['luis', true], ['ana', false]])
  assert.deepEqual(tue.contenders[1].alternatives.map((o) => o.slotId), ['wed10'])
})

test('otherwise the first to ask is suggested; an uncontested time suggests nobody', () => {
  const ana = req('ana', 120, ['tue15', 24], ['wed10', 48])
  const carmen = req('carmen', 30, ['tue15', 24], ['thu09', 72])
  const plan = planRequests([carmen, ana], slots, NOW)
  assert.equal(plan.times.find((t) => t.slotId === 'tue15')!.contenders[0].booking.id, 'ana')
  assert.equal(plan.times.find((t) => t.slotId === 'wed10')!.contenders[0].suggested, false)
  assert.deepEqual(plan.times.map((t) => t.slotId), ['tue15', 'wed10', 'thu09'])
})

test('taken, removed and past times drop out; a request left with none needs a new time', () => {
  const marta = req('marta', 10, ['fri', 96], ['gone', 30], ['old', -2])
  const ana = req('ana', 5, ['fri', 96], ['tue15', 24])
  const plan = planRequests([marta, ana], slots, NOW)
  assert.deepEqual(plan.stranded.map((b) => b.id), ['marta'])
  assert.deepEqual(plan.times.map((t) => t.slotId), ['tue15'])
  assert.deepEqual(plan.times[0].contenders[0].alternatives, [])
})
