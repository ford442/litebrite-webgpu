// Lite Brite colors in a specific order
export const COLORS = [
  { id: 1, name: 'Red', hex: '#ff0000' },
  { id: 2, name: 'Orange', hex: '#ff8019' },
  { id: 3, name: 'Yellow', hex: '#ffff00' },
  { id: 4, name: 'Green', hex: '#33ff33' },
  { id: 5, name: 'Cyan', hex: '#00ffff' },
  { id: 6, name: 'Light Blue', hex: '#33ccff' },
  { id: 7, name: 'Blue', hex: '#3380ff' },
  { id: 8, name: 'Purple', hex: '#9933ff' },
  { id: 9, name: 'Pink', hex: '#ff33cc' },
  { id: 10, name: 'White', hex: '#ffffff' },
  { id: 0, name: 'Eraser', hex: '#1a1a1a' },
];

export type ColorInfo = typeof COLORS[number];
