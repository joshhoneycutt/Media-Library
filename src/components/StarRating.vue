<template>
  <div
    class="stars"
    :class="{ interactive: !readonly }"
    @mouseleave="hovered = null"
  >
    <span v-for="n in 5" :key="n" class="star-wrap">
      <!-- dimmed base star -->
      <span class="star-base">★</span>
      <!-- filled left half -->
      <span
        class="star-fill left"
        :class="{ lit: displayRating >= n - 0.5 }"
        @mousemove.stop="!readonly && (hovered = n - 0.5)"
        @click.stop="!readonly && toggle(n - 0.5)"
      ><span>★</span></span>
      <!-- filled right half -->
      <span
        class="star-fill right"
        :class="{ lit: displayRating >= n }"
        @mousemove.stop="!readonly && (hovered = n)"
        @click.stop="!readonly && toggle(n)"
      ><span>★</span></span>
    </span>
    <span v-if="showValue && modelValue" class="star-value">{{ modelValue }}</span>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
  showValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const hovered = ref(null)
const displayRating = computed(() => hovered.value ?? props.modelValue)

function toggle(val) {
  emit('update:modelValue', props.modelValue === val ? 0 : val)
}
</script>

<style scoped>
.stars {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  line-height: 1;
}

.star-wrap {
  position: relative;
  display: inline-block;
  font-size: 1.75rem;
  width: 0.9em;
  height: 1em;
}

.star-base {
  position: absolute;
  left: 0; top: 0;
  color: var(--text-3);
  pointer-events: none;
  user-select: none;
}

/* clipped halves sit on top of the base */
.star-fill {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  overflow: hidden;
  color: var(--text-3);
  transition: color 0.08s;
}
.star-fill.left  { left: 0; }
.star-fill.right { left: 50%; }

/* The inner ★ is always full-width; right half shifts it left so we see only its right side */
.star-fill span {
  display: block;
  white-space: nowrap;
  width: 0.9em; /* match star-wrap width */
}
.star-fill.right span { margin-left: -100%; }

.star-fill.lit { color: var(--badge-4k); }

.interactive .star-fill { cursor: pointer; }

.star-value {
  font-size: 0.9rem;
  color: var(--text-2);
  margin-left: 0.5rem;
}
</style>
