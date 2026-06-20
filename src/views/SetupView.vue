<template>
  <div class="setup">
    <div class="setup-card">
      <h1>Welcome to <span class="accent">THE LIBRARY</span></h1>
      <p>To fetch movie details, you need a free TMDB API key.</p>
      <ol>
        <li>Go to <strong>themoviedb.org</strong> and create a free account</li>
        <li>In your account settings, go to <strong>API</strong> and request an API key</li>
        <li>Copy the <strong>API Read Access Token</strong> and paste it below</li>
      </ol>
      <form @submit.prevent="save">
        <label for="apikey">TMDB API Read Access Token</label>
        <input
          id="apikey"
          v-model="key"
          type="text"
          placeholder="Paste your TMDB Read Access Token here"
          autocomplete="off"
          spellcheck="false"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="!key.trim()">Save &amp; Continue</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTmdbStore } from '@/stores/tmdb.js'

const tmdb = useTmdbStore()
const router = useRouter()
const key = ref('')
const error = ref('')

function save() {
  if (!key.value.trim()) return
  tmdb.setApiKey(key.value)
  router.push({ name: 'collection' })
}
</script>

<style scoped>
.setup {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
.setup-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 2.5rem;
  max-width: 520px;
  width: 100%;
}
h1 { font-size: 1.75rem; margin-bottom: 1rem; }
.accent { color: var(--accent); }
p { color: var(--text-2); margin-bottom: 1rem; line-height: 1.6; }
ol { color: var(--text-2); margin: 0 0 1.5rem 1.2rem; line-height: 2; }
ol strong { color: var(--text); }
label { display: block; font-size: 0.85rem; color: var(--text-2); margin-bottom: 0.4rem; }
input {
  width: 100%; padding: 0.75rem 1rem;
  background: var(--surface-2); border: 1px solid var(--text-3);
  border-radius: var(--radius); color: var(--text);
  font-size: 0.95rem; margin-bottom: 1rem;
}
input:focus { outline: 2px solid var(--accent); border-color: transparent; }
button {
  background: var(--accent); color: #fff;
  padding: 0.75rem 2rem; border: none;
  border-radius: var(--radius); font-size: 1rem; font-weight: 600;
}
button:hover:not(:disabled) { background: var(--accent-hover); }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.error { color: var(--accent); font-size: 0.85rem; margin-bottom: 0.75rem; }
</style>
