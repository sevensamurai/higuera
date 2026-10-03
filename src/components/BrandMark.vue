<script setup lang="ts">
// The researcher's mark — a head with a sprout growing inside, in two colours — drawn inline for the header, where
// the band is its background. public/favicon.svg is the same drawing on a tile (tab and app icons).
defineProps<{ size?: number }>()
</script>

<template>
  <svg :width="size ?? 40" :height="size ?? 40" viewBox="6 7 50 52" aria-hidden="true">
    <path
      d="M44 57v-9.5c5.2-3.6 8.5-9.6 8.5-16.5 0-12.4-8.9-21.5-20.5-21.5S12.6 17.5 12.6 28.4c0 2.1-.4 3.6-1.4 5.2l-2.3 3.8c-.5.9.1 2 1.1 2h2.4V42l-.8 1.2.8 1.2v.8c0 2.7 2.2 4.8 4.9 4.8H22v7"
      fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"
    />
    <!-- The sprout sits low in the head, clear of the crown. -->
    <g fill="#4fc3b3" transform="translate(0 6)">
      <path d="M31.5 45.5V24" fill="none" stroke="#4fc3b3" stroke-width="2.8" stroke-linecap="round" />
      <path d="M31.5 37.5c-1-5.8-5.4-9-11-8.8.4 5.9 4.8 9.3 11 8.8Z" />
      <path d="M31.5 31.8c.6-6.3 5-10 11.1-10-.2 6.3-4.8 10.2-11.1 10Z" />
      <path d="M31.5 25.2c-3.8-3.8-3.8-9 0-12.8 3.8 3.8 3.8 9 0 12.8Z" />
    </g>
  </svg>
</template>
