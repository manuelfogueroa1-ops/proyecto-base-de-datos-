<script setup>
defineProps({ name: { type: String, required: true } });

const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  trophy: 'M8 21h8 M12 17v4 M7 3h10v7a5 5 0 0 1-10 0V3z M7 5H3v2a4 4 0 0 0 4 4 M17 5h4v2a4 4 0 0 1-4 4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-4 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M17 3a4 4 0 0 1 0 8',
  chart: 'M3 3v18h18 M7 16l4-5 4 2 5-7',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  external: 'M7 17 17 7 M7 7h10v10',
  calendar: 'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M5 7a8 8 0 0 1 13-2l2 2 M4 17l2 2a8 8 0 0 0 13-2',
  game: 'M6 6h12a3 3 0 0 1 3 2.4l1 5a3 3 0 0 1-5 2.8L15 14H9l-2 2.2a3 3 0 0 1-5-2.8l1-5A3 3 0 0 1 6 6z M6 10h4 M8 8v4 M16 10h.01 M18 12h.01',
  chevron: 'm6 9 6 6 6-6',
  flag: 'M5 22V3 M5 4c5-4 9 4 14 0v11c-5 4-9-4-14 0',
  speed: 'M3 17a9 9 0 1 1 18 0H3z M12 8v2 M6 11l1.5 1.5 M12 17l4-5',
  target: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 2v6 M12 16v6 M2 12h6 M16 12h6',
  crystal: 'M12 2 5 9l7 13 7-13-7-7z M5 9h14 M12 2 9 9l3 13 3-13-3-7z',
  strike: 'm13 2-9 12h7l-1 8 10-12h-8l1-8z',
};
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
