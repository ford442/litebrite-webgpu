import { COLORS } from '../constants/colors';

const PEG_SPACING = 32;

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

  if (r < 30 && g < 30 && b < 30) {
    return 0;
  }

  COLORS.forEach(color => {
    if (color.id === 0) return;
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
      const canvasWidth = boardWidth * PEG_SPACING;
      const canvasHeight = boardHeight * PEG_SPACING;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (canvasWidth - w) / 2;
      const y = (canvasHeight - h) / 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, x, y, w, h);

      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const pixels = imageData.data;
      const boardData = new Uint32Array(boardWidth * boardHeight);

      for (let y = 0; y < boardHeight; y++) {
        for (let x = 0; x < boardWidth; x++) {
          const rowShift = (y % 2 !== 0) ? (PEG_SPACING / 2) : 0;
          const centerX = Math.floor(x * PEG_SPACING + (PEG_SPACING / 2) + rowShift);
          const centerY = Math.floor(y * PEG_SPACING + (PEG_SPACING / 2));
          const pixelIndex = (centerY * canvasWidth + centerX) * 4;

          if (pixelIndex < 0 || pixelIndex >= pixels.length) continue;

          const r = pixels[pixelIndex];
          const g = pixels[pixelIndex + 1];
          const b = pixels[pixelIndex + 2];
          
          boardData[y * boardWidth + x] = findClosestColorIndex(r, g, b);
        }
      }

      resolve(boardData);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
