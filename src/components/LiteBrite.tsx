import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiteBriteGPU } from '../hooks/useLiteBriteGPU';
import { useLiteBriteCanvas } from '../hooks/useLiteBriteCanvas';
import { ColorPalette } from './ColorPalette';
import { processImageToBoard } from '../utils/imageProcessing';
import './LiteBrite.css';

// Board dimensions in pegs
const BOARD_WIDTH = 32;
const BOARD_HEIGHT = 24;
const PEG_SPACING = 32;

// Helper function to play a synthesized 'pop' sound
const playPopSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) {
    console.warn("Web Audio API is not supported in this browser.");
    return;
  }
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
};

/**
 * Finds the physically closest peg to the mouse cursor on a staggered grid.
 * This is more robust than simple geometric calculation as it checks neighboring
 * rows to resolve ambiguity at the boundaries.
 * @returns The logical {x, y} coordinates of the closest peg.
 */
const getClosestPeg = (
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement
): { x: number; y: number } => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // 1. Get raw pixel coordinates in the canvas's own resolution
  const px = (clientX - rect.left) * scaleX;
  const py = (clientY - rect.top) * scaleY;

  // 2. Identify the rough logical row the cursor is in (our starting point)
  const roughRow = Math.floor(py / PEG_SPACING);

  // 3. We will check the rough row, plus the row above and below,
  //    to find the true closest peg center. This is the key to solving the
  //    "zigzag" boundary problem between staggered rows.
  let closestPeg = { x: -1, y: -1 };
  let minDistanceSq = Infinity; // Use squared distance to avoid costly sqrt

  // Check the relevant rows (usually 3, fewer at top/bottom edges)
  for (let r = roughRow - 1; r <= roughRow + 1; r++) {
    // Ensure the row is within board boundaries
    if (r < 0 || r >= BOARD_HEIGHT) continue;

    // Calculate the horizontal offset for this specific row
    const rowOffset = (r % 2 !== 0) ? (PEG_SPACING / 2) : 0;
    
    // Find the approximate column in this row by finding the nearest grid center
    const c = Math.round((px - rowOffset - (PEG_SPACING / 2)) / PEG_SPACING);

    // Ensure the column is within board boundaries
    if (c < 0 || c >= BOARD_WIDTH) continue;

    // Calculate the PHYSICAL center of this candidate peg in pixel space
    const centerX = c * PEG_SPACING + (PEG_SPACING / 2) + rowOffset;
    const centerY = r * PEG_SPACING + (PEG_SPACING / 2);

    // Get distance squared (more efficient for comparison)
    const dx = px - centerX;
    const dy = py - centerY;
    const distSq = dx * dx + dy * dy;

    // If this peg is closer than any we've seen so far, record it
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestPeg = { x: c, y: r };
    }
  }

  return closestPeg;
};


// WebGPU version of the board
function LiteBriteWebGPU({ selectedColor, onColorSelect }: { selectedColor: number; onColorSelect: (color: number) => void }) {
  const [glowIntensity, setGlowIntensity] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / 1500, 1);
      const value = 1 - Math.pow(1 - progress, 3);
      setGlowIntensity(value * 1.3);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  const { canvasRef, isReady, setPixel, setBoard, clearBoard } = useLiteBriteGPU({
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    glowIntensity: glowIntensity,
  });

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    // Use the new helper to find the truly closest peg
    const { x, y } = getClosestPeg(e.clientX, e.clientY, canvasRef.current);

    if (x !== -1 && y !== -1) { // Check for a valid peg
      setPixel(x, y, selectedColor);
      playPopSound(); 
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only draw if the left mouse button is held down
    if (e.buttons !== 1 || !canvasRef.current) return;
    
    const { x, y } = getClosestPeg(e.clientX, e.clientY, canvasRef.current);
    
    if (x !== -1 && y !== -1) {
      // The setPixel function should ideally prevent redundant state updates
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    if (!canvasRef.current || e.touches.length === 0) return;
    const { x, y } = getClosestPeg(e.touches[0].clientX, e.touches[0].clientY, canvasRef.current);
    if (x !== -1 && y !== -1) {
      setPixel(x, y, selectedColor);
      playPopSound();
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    if (!canvasRef.current || e.touches.length === 0) return;
    const { x, y } = getClosestPeg(e.touches[0].clientX, e.touches[0].clientY, canvasRef.current);
    if (x !== -1 && y !== -1) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleClear = useCallback(() => clearBoard(), [clearBoard]);

  const handleImageUpload = useCallback(async (file: File) => {
    try {
      const data = await processImageToBoard(file, BOARD_WIDTH, BOARD_HEIGHT);
      setBoard(data);
    } catch (err) {
      console.error('Failed to process image', err);
      alert('Failed to load image. Please try another one.');
    }
  }, [setBoard]);

  return (
    <LiteBriteUI
      canvasRef={canvasRef}
      isReady={isReady}
      subtitle="WebGPU Edition"
      selectedColor={selectedColor}
      onColorSelect={onColorSelect}
      onMouseDown={handleCanvasClick}
      onMouseMove={handleCanvasMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClear={handleClear}
      onImageUpload={handleImageUpload}
    />
  );
}

// Canvas 2D version of the board (fallback)
function LiteBriteCanvas2D({ selectedColor, onColorSelect }: { selectedColor: number; onColorSelect: (color: number) => void }) {
  const [glowIntensity, setGlowIntensity] = useState(0);

  useEffect(() => {
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / 1500, 1);
      const value = 1 - Math.pow(1 - progress, 3);
      setGlowIntensity(value * 1.3);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  const { canvasRef, isReady, setPixel, setBoard, clearBoard } = useLiteBriteCanvas({
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    glowIntensity: glowIntensity,
  });

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const { x, y } = getClosestPeg(e.clientX, e.clientY, canvasRef.current);
    if (x !== -1 && y !== -1) {
      setPixel(x, y, selectedColor);
      playPopSound();
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 || !canvasRef.current) return;
    const { x, y } = getClosestPeg(e.clientX, e.clientY, canvasRef.current);
    if (x !== -1 && y !== -1) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    if (!canvasRef.current || e.touches.length === 0) return;
    const { x, y } = getClosestPeg(e.touches[0].clientX, e.touches[0].clientY, canvasRef.current);
    if (x !== -1 && y !== -1) {
      setPixel(x, y, selectedColor);
      playPopSound();
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    if (!canvasRef.current || e.touches.length === 0) return;
    const { x, y } = getClosestPeg(e.touches[0].clientX, e.touches[0].clientY, canvasRef.current);
    if (x !== -1 && y !== -1) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleClear = useCallback(() => clearBoard(), [clearBoard]);

  const handleImageUpload = useCallback(async (file: File) => {
    try {
      const data = await processImageToBoard(file, BOARD_WIDTH, BOARD_HEIGHT);
      setBoard(data);
    } catch (err) {
      console.error('Failed to process image', err);
      alert('Failed to load image. Please try another one.');
    }
  }, [setBoard]);

  return (
    <LiteBriteUI
      canvasRef={canvasRef}
      isReady={isReady}
      subtitle="Canvas Edition"
      selectedColor={selectedColor}
      onColorSelect={onColorSelect}
      onMouseDown={handleCanvasClick}
      onMouseMove={handleCanvasMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClear={handleClear}
      onImageUpload={handleImageUpload}
    />
  );
}

// UI component shared by both renderers
function LiteBriteUI({
  canvasRef,
  isReady,
  subtitle,
  selectedColor,
  onColorSelect,
  onMouseDown,
  onMouseMove,
  onTouchStart,
  onTouchMove,
  onClear,
  onImageUpload,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  subtitle: string;
  selectedColor: number;
  onColorSelect: (color: number) => void;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onClear: () => void;
  onImageUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
    if (e.target) e.target.value = '';
  };

  return (
    <div className="litebrite-container">
      <header className="litebrite-header">
        <h1 className="litebrite-title">
          <span className="lite">LITE</span>
          <span className="brite">BRITE</span>
        </h1>
        <p className="litebrite-subtitle">{subtitle}</p>
      </header>

      <div className="litebrite-frame">
        <div className="litebrite-screen">
          <canvas
            ref={canvasRef}
            width={BOARD_WIDTH * PEG_SPACING}
            height={BOARD_HEIGHT * PEG_SPACING}
            className="litebrite-canvas"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
          />
          {!isReady && (
            <div className="litebrite-loading">
              <span>Loading...</span>
            </div>
          )}
        </div>
      </div>

      <div className="litebrite-controls">
        <ColorPalette
          selectedColor={selectedColor}
          onColorSelect={onColorSelect}
        />
        <div className="litebrite-actions">
           <button className="litebrite-btn clear-btn" onClick={onClear}>
            Clear Board
          </button>
          <button className="litebrite-btn upload-btn" onClick={() => fileInputRef.current?.click()}>
            Upload Image
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="litebrite-instructions">
        <p>Click or drag on the board to place pegs</p>
        <p>Select a color from the palette below</p>
      </div>
    </div>
  );
}

export function LiteBrite() {
  const [selectedColor, setSelectedColor] = useState(1);
  const [useWebGPU, setUseWebGPU] = useState<boolean | null>(null);

  useEffect(() => {
    const checkWebGPU = async () => {
      if (!navigator.gpu) {
        setUseWebGPU(false);
        return;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setUseWebGPU(false);
          return;
        }
        setUseWebGPU(true);
      } catch {
        setUseWebGPU(false);
      }
    };
    checkWebGPU();
  }, []);

  if (useWebGPU === null) {
    return (
      <div className="litebrite-container">
        <header className="litebrite-header">
          <h1 className="litebrite-title">
            <span className="lite">LITE</span>
            <span className="brite">BRITE</span>
          </h1>
        </header>
        <div className="litebrite-loading-screen">
          <span>Initializing...</span>
        </div>
      </div>
    );
  }

  if (useWebGPU) {
    return <LiteBriteWebGPU selectedColor={selectedColor} onColorSelect={setSelectedColor} />;
  }

  return <LiteBriteCanvas2D selectedColor={selectedColor} onColorSelect={setSelectedColor} />;
}
