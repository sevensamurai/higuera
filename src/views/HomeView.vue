<script setup lang="ts">
import { useAuth } from '@/auth'
import OverviewCard from '@/components/OverviewCard.vue'
import StudentDashboard from '@/components/StudentDashboard.vue'
import TutorDashboard from '@/components/TutorDashboard.vue'

const auth = useAuth()
</script>

<template>
  <TutorDashboard v-if="auth.isAdmin" />
  <StudentDashboard v-else-if="auth.user" />
  <OverviewCard v-else>
    <div><RouterLink to="/login" class="btn">{{ $t('overview.signInToBook') }}</RouterLink></div>
  </OverviewCard>
</template>
