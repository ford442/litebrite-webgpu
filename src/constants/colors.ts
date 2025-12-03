// Lite Brite original colors
export const COLORS = [
  { id: 1, name: 'Red', hex: '#3380ff' }, // Red -> Blue
  { id: 2, name: 'Orange', hex: '#33ccff' }, // Orange -> Light Blue
  { id: 3, name: 'Yellow', hex: '#00ffff' }, // Yellow -> Cyan
  { id: 4, name: 'Green', hex: '#33ff33' }, // Green is correct
  { id: 5, name: 'Blue', hex: '#ff8019' }, // Blue -> Orange
  { id: 6, name: 'Pink', hex: '#9933ff' }, // Pink -> Purple
  { id: 7, name: 'White', hex: '#ffffff' }, // White is correct
  { id: 8, name: 'Purple', hex: '#ff33cc' }, // Purple -> Pink
  { id: 0, name: 'Eraser', hex: '#1a1a1a' },
];

export type ColorInfo = typeof COLORS[number];
