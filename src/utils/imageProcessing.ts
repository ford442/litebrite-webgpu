import { COLORS } from '../constants/colors';

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Calculate color distance (Euclidean)
function getColorDistance(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

// Find closest Lite Brite color
function findClosestColorIndex(r: number, g: number, b: number): number {
  let minDistance = Infinity;
  let closestIndex = 0; // Eraser/Empty

  // Threshold to determine if a pixel is "black" or empty
  // If a pixel is very dark, we treat it as empty (color 0)
  if (r < 30 && g < 30 && b < 30) {
    return 0;
  }

  COLORS.forEach(color => {
    if (color.id === 0) return; // Skip eraser during distance check

    const rgb = hexToRgb(color.hex);
    const distance = getColorDistance({ r, g, b }, rgb);

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = color.id;
    }
  });

  return closestIndex;
}

export async function processImageToBoard(
  file: File,
  boardWidth: number,
  boardHeight: number
): Promise<Uint32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = boardWidth;
      canvas.height = boardHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw image to canvas, scaling it to board dimensions
      // Use 'contain' logic to preserve aspect ratio
      const scale = Math.min(boardWidth / img.width, boardHeight / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (boardWidth - w) / 2;
      const y = (boardHeight - h) / 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, boardWidth, boardHeight);
      ctx.drawImage(img, x, y, w, h);

      const imageData = ctx.getImageData(0, 0, boardWidth, boardHeight);
      const pixels = imageData.data;
      const result = new Uint32Array(boardWidth * boardHeight);

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        const pixelIndex = i / 4;

        // If transparent, use eraser
        if (a < 128) {
          result[pixelIndex] = 0;
        } else {
          result[pixelIndex] = findClosestColorIndex(r, g, b);
        }
      }

      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
