// Keeps the two UI languages in step: same keys, same {placeholders}, same number of plural forms.
// Run with `npm run test:unit`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import en from '../src/i18n/en.ts'
import es from '../src/i18n/es.ts'

type Tree = { [k: string]: string | Tree }
function flatten(t: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.set(key, v)
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv)
  }
  return out
}
const E = flatten(en as Tree)
const S = flatten(es as Tree)
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

test('both languages define exactly the same keys', () => {
  assert.deepEqual([...S.keys()].sort(), [...E.keys()].sort())
})

test('no empty translations', () => {
  for (const [k, v] of S) assert.ok(v.trim(), `es.${k} is empty`)
})

test('placeholders match, so no {value} is dropped or misspelled', () => {
  for (const [k, v] of E) assert.equal(placeholders(S.get(k)!), placeholders(v), k)
})

test('plural messages have the same number of forms', () => {
  for (const [k, v] of E) assert.equal(S.get(k)!.split('|').length, v.split('|').length, k)
})
