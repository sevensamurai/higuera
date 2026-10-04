<script setup lang="ts">
// Full-width photo behind the signed-out pages, with its credit. Self-hosted WebP in three widths.
const PHOTO = 'https://www.pexels.com/photo/close-up-of-vintage-photographs-4394514/'
</script>

<template>
  <section class="hero">
    <img
      class="hero-img"
      src="/home/hero-1080.webp"
      srcset="/home/hero-640.webp 640w, /home/hero-1080.webp 1080w, /home/hero-1920.webp 1920w"
      sizes="100vw"
      alt=""
      fetchpriority="high"
    />
    <div class="hero-content"><slot /></div>
    <p class="hero-credit">
      {{ $t('hero.photo') }} <a :href="PHOTO" target="_blank" rel="noopener">Susanne Jutzeler</a> · Pexels
    </p>
  </section>
</template>
