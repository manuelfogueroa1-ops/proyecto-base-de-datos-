const themes = {
  'assetto corsa': { key: 'assetto', icon: 'speed' },
  'counter-strike': { key: 'counter', icon: 'target' },
  'league of legends': { key: 'league', icon: 'crystal' },
  'valorant': { key: 'valorant', icon: 'strike' },
};

const defaultTheme = { key: null, icon: 'game' };

export function gameTheme(name) {
  const key = name.trim().toLowerCase();
  return Object.hasOwn(themes, key) ? themes[key] : defaultTheme;
}
