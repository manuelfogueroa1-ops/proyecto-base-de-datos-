<script setup>
import { computed } from 'vue';
import { gameTheme } from './gameTheme.js';

const props = defineProps({
  game: { type: String, required: true },
});

const cover = computed(() => gameTheme(props.game).key);
</script>

<template>
  <span class="tournament-art" :data-cover="cover" aria-hidden="true">
    <img v-if="cover" :src="`/torneos/${cover}.webp`" alt="" decoding="async" />
    <span class="tournament-art-light"></span>
  </span>
</template>
