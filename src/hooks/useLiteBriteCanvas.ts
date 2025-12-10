import { useEffect, useRef, useCallback } from 'react';
import { COLORS } from '../constants/colors';

const PEG_SPACING = 32;

export interface UseLiteBriteCanvasOptions {
  boardWidth: number;
  boardHeight: number;
  glowIntensity?: number;
  ambientBrightness?: number;
  pegBrightness?: number;
}

export interface UseLiteBriteCanvasResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  setPixel: (x: number, y: number, colorIndex: number) => void;
  setBoard: (data: Uint32Array) => void;
  clearBoard: () => void;
  getBoardState: () => Uint32Array;
}

// Get color by id - returns hex color string
function getColorById(colorIndex: number): string {
  const color = COLORS.find(c => c.id === colorIndex);
  return color ? color.hex : '#000000';
}

// Convert hex color to rgba with specified alpha (0-1)
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function useLiteBriteCanvas({
  boardWidth,
  boardHeight,
  glowIntensity = 1.3,
  ambientBrightness = 1.0,
  pegBrightness = 1.0,
}: UseLiteBriteCanvasOptions): UseLiteBriteCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardStateRef = useRef<Uint32Array>(new Uint32Array(boardWidth * boardHeight));
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const pixelWidth = boardWidth * PEG_SPACING;
  const pixelHeight = boardHeight * PEG_SPACING;

  // Initialize and start animation
  useEffect(() => {
    startTimeRef.current = performance.now();

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const time = (performance.now() - startTimeRef.current) / 1000;

      // Clear canvas with dark background (modulated by ambientBrightness)
      // We approximate this by overlaying a black rect with varying opacity, or just dimming the fill style.
      // Simple approach: reduce the component value. 0x05 = 5. 5 * ambient.
      const bgVal = Math.max(0, Math.min(255, Math.floor(5 * ambientBrightness)));
      const bgHex = '#' + bgVal.toString(16).padStart(2, '0').repeat(3);
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, pixelWidth, pixelHeight);

      // Draw each peg
      for (let y = 0; y < boardHeight; y++) {
        for (let x = 0; x < boardWidth; x++) {
          const colorIndex = boardStateRef.current[y * boardWidth + x];
          const centerX = x * PEG_SPACING + PEG_SPACING / 2;
          const centerY = y * PEG_SPACING + PEG_SPACING / 2;
          const pegRadius = 6;

          if (colorIndex > 0) {
            // Draw glow
            const color = getColorById(colorIndex);
            const pulseAmount = Math.sin(time * 2 + (y * boardWidth + x) * 0.1) * 0.1 + 0.9;
            const intensity = glowIntensity * pulseAmount * pegBrightness;

            // Outer glow
            const gradient = ctx.createRadialGradient(
              centerX, centerY, pegRadius * 0.5,
              centerX, centerY, pegRadius * 1.8
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(0.5, hexToRgba(color, 0.5));
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.arc(centerX, centerY, pegRadius * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Main peg with inner glow
            const innerGradient = ctx.createRadialGradient(
              centerX - 2, centerY - 2, 0,
              centerX, centerY, pegRadius
            );
            innerGradient.addColorStop(0, '#ffffff');
            innerGradient.addColorStop(0.3, color);
            innerGradient.addColorStop(1, color);

            ctx.beginPath();
            ctx.arc(centerX, centerY, pegRadius, 0, Math.PI * 2);
            ctx.fillStyle = innerGradient;
            ctx.globalAlpha = intensity;
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            // Empty peg hole
            ctx.beginPath();
            ctx.arc(centerX, centerY, pegRadius * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = '#020202';
            ctx.fill();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [boardWidth, boardHeight, pixelWidth, pixelHeight, glowIntensity, ambientBrightness, pegBrightness]);

  const setPixel = useCallback((x: number, y: number, colorIndex: number) => {
    // console.log(`Canvas setPixel: ${x}, ${y}, ${colorIndex}`); // Debug
    if (x >= 0 && x < boardWidth && y >= 0 && y < boardHeight) {
      boardStateRef.current[y * boardWidth + x] = colorIndex;
    }
  }, [boardWidth, boardHeight]);

  const setBoard = useCallback((data: Uint32Array) => {
    if (data.length === boardStateRef.current.length) {
      boardStateRef.current.set(data);
    }
  }, []);

  const clearBoard = useCallback(() => {
    boardStateRef.current.fill(0);
  }, []);

  const getBoardState = useCallback(() => {
    return new Uint32Array(boardStateRef.current);
  }, []);

  return {
    canvasRef,
    isReady: true,
    setPixel,
    setBoard,
    clearBoard,
    getBoardState,
  };
}
