import type React from 'react';
import { COLORS } from '../constants/colors';
import './ColorPalette.css';

interface ColorPaletteProps {
  selectedColor: number;
  onColorSelect: (colorId: number) => void;
}

export function ColorPalette({ selectedColor, onColorSelect }: ColorPaletteProps) {
  const handleColorClick = (colorId: number) => {
    onColorSelect(colorId);
  };

  const handleKeyDown = (e: React.KeyboardEvent, colorId: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onColorSelect(colorId);
    }
  };

  return (
    <div className="color-palette">
      <h3 className="palette-title">Colors</h3>
      <div className="color-tray">
        {COLORS.map((color) => (
          <button
            key={color.id}
            className={`color-peg ${selectedColor === color.id ? 'selected' : ''} ${color.id === 0 ? 'eraser' : ''}`}
            style={{ '--peg-color': color.hex } as React.CSSProperties}
            onClick={() => handleColorClick(color.id)}
            onKeyDown={(e) => handleKeyDown(e, color.id)}
            title={color.name}
            aria-label={color.name}
            aria-pressed={selectedColor === color.id}
          >
            {color.id === 0 && <span className="eraser-icon">✕</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
