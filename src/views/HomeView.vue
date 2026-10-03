<script setup lang="ts">
import { useAuth } from '@/auth'
import OverviewCard from '@/components/OverviewCard.vue'
import StudentDashboard from '@/components/StudentDashboard.vue'
import TutorDashboard from '@/components/TutorDashboard.vue'
import HeroBackdrop from '@/components/HeroBackdrop.vue'
import SignInButton from '@/components/SignInButton.vue'

const auth = useAuth()
</script>

<template>
  <TutorDashboard v-if="auth.isAdmin" />
  <StudentDashboard v-else-if="auth.user" />
  <HeroBackdrop v-else>
    <OverviewCard>
      <div><SignInButton /></div>
    </OverviewCard>
  </HeroBackdrop>
</template>
