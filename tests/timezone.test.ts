// Unit tests for wall-clock ↔ instant conversion. Run with `npm run test:unit`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayIn, zonedToDate } from '../src/timezone.ts'

const iso = (d: Date) => d.toISOString().slice(0, 16)

test('wall time in a fixed-offset zone', () => {
  assert.equal(iso(zonedToDate('2026-11-14', '10:00', 'America/Sao_Paulo')), '2026-11-14T13:00')
  assert.equal(iso(zonedToDate('2026-11-14', '10:00', 'Asia/Kolkata')), '2026-11-14T04:30')
})

test('same wall time, different side of a DST change', () => {
  assert.equal(iso(zonedToDate('2026-07-01', '09:00', 'Europe/Lisbon')), '2026-07-01T08:00') // WEST, +1
  assert.equal(iso(zonedToDate('2026-12-01', '09:00', 'Europe/Lisbon')), '2026-12-01T09:00') // WET, +0
  assert.equal(iso(zonedToDate('2026-07-01', '09:00', 'Australia/Sydney')), '2026-06-30T23:00') // AEST, +10
  assert.equal(iso(zonedToDate('2026-12-01', '09:00', 'Australia/Sydney')), '2026-11-30T22:00') // AEDT, +11
})

test('on the DST transition day itself', () => {
  // US springs forward 2026-03-08 at 02:00; 10:00 that morning is already EDT (-4).
  assert.equal(iso(zonedToDate('2026-03-08', '10:00', 'America/New_York')), '2026-03-08T14:00')
  assert.equal(iso(zonedToDate('2026-03-08', '01:00', 'America/New_York')), '2026-03-08T06:00')
})

test('a time inside the spring-forward gap lands just after it', () => {
  // 02:30 never happens in New York on 2026-03-08; 03:30 EDT is the next real instant.
  assert.equal(iso(zonedToDate('2026-03-08', '02:30', 'America/New_York')), '2026-03-08T07:30')
})

test('a time in the fall-back overlap takes the first occurrence', () => {
  // 01:30 happens twice in New York on 2026-11-01; the first is EDT (-4).
  assert.equal(iso(zonedToDate('2026-11-01', '01:30', 'America/New_York')), '2026-11-01T05:30')
})

test('the same instant falls on different days for different people', () => {
  const t = zonedToDate('2026-11-14', '21:00', 'America/Los_Angeles') // Sat 21:00 in LA
  assert.equal(dayIn(t, 'America/Los_Angeles'), '2026-11-14')
  assert.equal(dayIn(t, 'Europe/Madrid'), '2026-11-15') // Sun 06:00 in Madrid
})
