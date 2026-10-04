<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import { allTimeZones, browserTimeZone } from '@/timezone'
import { fold, tzLabel, tzOffset } from '@/format'
import { intlLocale } from '@/i18n'

// A searchable timezone picker (ARIA combobox): type part of a city, a zone name in the current
// language ("Chile", "Pacific"), or an offset ("GMT-3", "+5:30"); arrows and Enter pick.
const model = defineModel<string>({ required: true })

function build(locale: string): Option[] {
  return allTimeZones().map((tz) => {
    const city = tz.split('/').pop()!.replace(/_/g, ' ')
    const offset = tzOffset(tz)
    let name = ''
    try {
      name = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: 'longGeneric' })
        .formatToParts(0)
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    } catch {
      /* runtime without longGeneric: city and offset still match */
    }
    return { tz, city, offset, name, hay: fold(`${tz.replace(/_/g, ' ')} ${name} ${offset} ${offset.replace('GMT', '')}`) }
  })
}
const options = computed(() => (cache[intlLocale.value] ??= build(intlLocale.value)))

const id = useId()
const input = ref<HTMLInputElement>()
const list = ref<HTMLElement>()
const open = ref(false)
const query = ref('')
const active = ref(0)
const text = ref(tzLabel(model.value))
watch(model, (v) => !open.value && (text.value = tzLabel(v)))

const shown = computed(() => {
  const terms = fold(query.value).split(/\s+/).filter(Boolean)
  if (!terms.length) return options.value
  return options.value.filter((o) => terms.every((t) => o.hay.includes(t)))
})

function scrollToActive() {
  nextTick(() => list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }))
}
function openList() {
  if (open.value) return
  open.value = true
  query.value = ''
  active.value = Math.max(0, shown.value.findIndex((o) => o.tz === model.value))
  scrollToActive()
}
function close() {
  open.value = false
  text.value = tzLabel(model.value)
}
function pick(o: Option | undefined) {
  if (o) model.value = o.tz
  close()
}
function onInput() {
  query.value = text.value
  open.value = true
  active.value = 0
}
function move(by: number) {
  if (!open.value) return openList()
  const n = shown.value.length
  if (n) active.value = (active.value + by + n) % n
  scrollToActive()
}
function onFocus() {
  openList()
  nextTick(() => input.value?.select())
}
</script>

<script lang="ts">
export interface Option {
  tz: string
  city: string
  offset: string
  /** The zone's name in the current language, e.g. "Chile Time" / "hora de Chile". */
  name: string
  /** Accent- and case-folded search text. */
  hay: string
}
// ~420 zones, built once per language per page load.
const cache: Record<string, Option[]> = {}
</script>

<template>
  <div class="tz-combo">
    <input
      ref="input"
      v-model="text"
      role="combobox"
      aria-autocomplete="list"
      autocomplete="off"
      spellcheck="false"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="open && shown[active] ? `${id}-${active}` : undefined"
      :placeholder="$t('tzPicker.placeholder')"
      @focus="onFocus"
      @click="openList"
      @input="onInput"
      @blur="close"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="open ? pick(shown[active]) : openList()"
      @keydown.esc="close"
    />
    <ul v-show="open" :id="`${id}-list`" ref="list" role="listbox" class="tz-list">
      <li
        v-for="(o, i) in shown"
        :id="`${id}-${i}`"
        :key="o.tz"
        role="option"
        :aria-selected="i === active"
        :class="{ current: o.tz === model }"
        @mousedown.prevent="pick(o)"
        @mousemove="active = i"
      >
        <span>
          <strong>{{ o.city }}</strong>
          <span v-if="o.tz === browserTimeZone" class="badge plain">{{ $t('tzPicker.thisDevice') }}</span>
          <br /><span class="muted small">{{ o.name ? `${o.name} · ` : '' }}{{ o.tz }}</span>
        </span>
        <span class="small">{{ o.offset }}</span>
      </li>
      <li v-if="!shown.length" class="muted small" role="presentation">{{ $t('tzPicker.none') }}</li>
    </ul>
  </div>
</template>
