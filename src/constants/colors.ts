// Lite Brite original colors
export const COLORS = [
  { id: 9, name: 'Red', hex: '#ff0000' }, // New Red
  { id: 5, name: 'Orange', hex: '#ff8019' }, // Was Blue -> Orange
  { id: 10, name: 'Yellow', hex: '#ffff00' }, // New Yellow
  { id: 4, name: 'Green', hex: '#33ff33' }, // Green is correct
  { id: 3, name: 'Cyan', hex: '#00ffff' }, // Was Yellow -> Cyan
  { id: 2, name: 'Light Blue', hex: '#33ccff' }, // Was Orange -> Light Blue
  { id: 1, name: 'Blue', hex: '#3380ff' }, // Was Red -> Blue
  { id: 6, name: 'Purple', hex: '#9933ff' }, // Was Pink -> Purple
  { id: 8, name: 'Pink', hex: '#ff33cc' }, // Was Purple -> Pink
  { id: 7, name: 'White', hex: '#ffffff' }, // White is correct
  { id: 0, name: 'Eraser', hex: '#1a1a1a' },
];

export type ColorInfo = typeof COLORS[number];
