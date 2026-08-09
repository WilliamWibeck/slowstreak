import type { ThemeDef } from '@/types'

export const THEMES: ThemeDef[] = [
  {
    id: 'nocturne',
    name: 'Nocturne',
    bg: '#161826',
    surface: '#1d1f30',
    divider: '#282b3d',
    empty: '#292b31',
    ramp: ['#2b2741', '#423a6a', '#5d5294', '#796cbf', '#968ae0'],
    accents: {
      700: '#423a6a',
      600: '#5d5294',
      base: '#9184d9',
      400: '#a99fe4',
      300: '#c0b8ec',
    },
  },
  {
    id: 'moss',
    name: 'Moss',
    bg: '#131a17',
    surface: '#1a2320',
    divider: '#25302a',
    empty: '#252d29',
    ramp: ['#223a2e', '#2f5343', '#417059', '#5a9273', '#7fb894'],
    accents: {
      700: '#2f5343',
      600: '#417059',
      base: '#7fb894',
      400: '#9bcaac',
      300: '#b8dcc4',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    bg: '#1a1614',
    surface: '#241e1a',
    divider: '#302722',
    empty: '#2e2724',
    ramp: ['#3d2a1f', '#593d2b', '#7d5539', '#a97350', '#d69168'],
    accents: {
      700: '#593d2b',
      600: '#7d5539',
      base: '#d69168',
      400: '#e3aa88',
      300: '#eec3a8',
    },
  },
  {
    id: 'tide',
    name: 'Tide',
    bg: '#101a1e',
    surface: '#172428',
    divider: '#203136',
    empty: '#242e31',
    ramp: ['#1c3941', '#26505c', '#356f7e', '#4a8fa3', '#6fb0c9'],
    accents: {
      700: '#26505c',
      600: '#356f7e',
      base: '#6fb0c9',
      400: '#92c6da',
      300: '#b3dbea',
    },
  },
  {
    id: 'ash',
    name: 'Ash',
    bg: '#17181b',
    surface: '#1f2024',
    divider: '#2a2c31',
    empty: '#2b2d32',
    ramp: ['#3a3b43', '#4e505a', '#676a76', '#8e909c', '#b9b3c4'],
    accents: {
      700: '#4e505a',
      600: '#676a76',
      base: '#b9b3c4',
      400: '#cbc7d3',
      300: '#dcd9e2',
    },
  },
]

export function themeById(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!
}

// Swaps the design-token CSS custom properties on the root element so every
// Tailwind utility built on --color-* repaints without a re-render.
export function applyTheme(id: string): void {
  const t = themeById(id)
  const r = document.documentElement.style
  r.setProperty('--color-bg', t.bg)
  r.setProperty('--color-surface', t.surface)
  r.setProperty('--color-divider', t.divider)
  r.setProperty('--color-accent', t.accents.base)
  r.setProperty('--color-accent-700', t.accents[700])
  r.setProperty('--color-accent-600', t.accents[600])
  r.setProperty('--color-accent-400', t.accents[400])
  r.setProperty('--color-accent-300', t.accents[300])
  // Remaining ramp steps used by badges and the heatmap legend.
  r.setProperty('--color-accent-900', t.ramp[0])
  r.setProperty('--color-accent-800', t.ramp[1])
  r.setProperty('--color-accent-500', t.ramp[4])
  r.setProperty('--color-accent-200', t.accents[300])
  r.setProperty('--color-accent-100', t.accents[300])
  document.body.style.background = t.bg
}
