<template>
  <span v-for="fmt in displayBadges" :key="fmt.label" :class="['badge', fmt.type]">
    {{ fmt.label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  formats: { type: Array, default: () => [] },
  notes: { type: Array, default: () => [] }
})

const displayBadges = computed(() => {
  const badges = []
  if (props.formats.includes('4K')) badges.push({ label: '4K', type: 'badge-4k' })
  if (props.formats.includes('Blu-ray')) badges.push({ label: 'Blu-ray', type: 'badge-bluray' })
  if (props.formats.includes('DVD')) badges.push({ label: 'DVD', type: 'badge-dvd' })
  const special = props.notes.find(n => n && n.trim())
  if (special) badges.push({ label: special, type: 'badge-special' })
  return badges
})
</script>

<style scoped>
.badge {
  display: inline-block; padding: 2px 7px;
  border-radius: 4px; font-size: 0.7rem;
  font-weight: 700; letter-spacing: 0.5px;
  margin-left: 4px; white-space: nowrap;
}
.badge-4k { background: var(--badge-4k); color: var(--badge-4k-text); }
.badge-bluray { background: var(--badge-bluray); color: var(--badge-bluray-text); }
.badge-dvd { background: var(--badge-dvd); color: var(--badge-dvd-text); }
.badge-special { background: var(--badge-special); color: var(--badge-special-text); }
</style>
