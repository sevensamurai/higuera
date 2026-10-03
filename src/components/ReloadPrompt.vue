<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()
const close = () => {
  needRefresh.value = false
  offlineReady.value = false
}
</script>

<template>
  <div v-if="needRefresh || offlineReady" class="toast" role="status">
    <span>{{ needRefresh ? $t('pwa.update') : $t('pwa.offline') }}</span>
    <button v-if="needRefresh" class="btn small" @click="updateServiceWorker(true)">{{ $t('pwa.reload') }}</button>
    <button class="link" @click="close">{{ $t('pwa.dismiss') }}</button>
  </div>
</template>
