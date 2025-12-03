import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiteBriteGPU } from '../hooks/useLiteBriteGPU';
import { useLiteBriteCanvas } from '../hooks/useLiteBriteCanvas';
import { ColorPalette } from './ColorPalette';
import { processImageToBoard } from '../utils/imageProcessing';
import './LiteBrite.css';

// Board dimensions in pegs (original Lite Brite was roughly 18x13)
const BOARD_WIDTH = 32;
const BOARD_HEIGHT = 24;
const PEG_SPACING = 32;

// WebGPU version of the board
function LiteBriteWebGPU({ selectedColor, onColorSelect }: { selectedColor: number; onColorSelect: (color: number) => void }) {
  const [glowIntensity, setGlowIntensity] = useState(0);

  // Startup animation
  useEffect(() => {
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / 1500, 1);
      // Ease out cubic
      const value = 1 - Math.pow(1 - progress, 3);
      setGlowIntensity(value * 1.3);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, []);

  const { canvasRef, isReady, setPixel, setBoard, clearBoard } = useLiteBriteGPU({
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    glowIntensity: glowIntensity,
  });

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / PEG_SPACING);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / PEG_SPACING);

    // console.log('Click:', x, y, selectedColor); // Debug

    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / PEG_SPACING);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / PEG_SPACING);
    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    // e.preventDefault(); // Removing preventDefault to allow scrolling if needed, or handle carefully
    if (e.cancelable) e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.touches[0].clientX - rect.left) * scaleX) / PEG_SPACING);
    const y = Math.floor(((e.touches[0].clientY - rect.top) * scaleY) / PEG_SPACING);
    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.touches[0].clientX - rect.left) * scaleX) / PEG_SPACING);
    const y = Math.floor(((e.touches[0].clientY - rect.top) * scaleY) / PEG_SPACING);
    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleClear = useCallback(() => {
    clearBoard();
  }, [clearBoard]);

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

  // Startup animation
  useEffect(() => {
    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / 1500, 1);
      const value = 1 - Math.pow(1 - progress, 3);
      setGlowIntensity(value * 1.3);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, []);

  const { canvasRef, isReady, setPixel, setBoard, clearBoard } = useLiteBriteCanvas({
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    glowIntensity: glowIntensity,
  });

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / PEG_SPACING);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / PEG_SPACING);
    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / PEG_SPACING);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / PEG_SPACING);
    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.touches[0].clientX - rect.left) * scaleX) / PEG_SPACING);
    const y = Math.floor(((e.touches[0].clientY - rect.top) * scaleY) / PEG_SPACING);
    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.touches[0].clientX - rect.left) * scaleX) / PEG_SPACING);
    const y = Math.floor(((e.touches[0].clientY - rect.top) * scaleY) / PEG_SPACING);
    if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
      setPixel(x, y, selectedColor);
    }
  }, [canvasRef, setPixel, selectedColor]);

  const handleClear = useCallback(() => {
    clearBoard();
  }, [clearBoard]);

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
    // Reset value so same file can be selected again
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
  const [selectedColor, setSelectedColor] = useState(1); // Default to red
  const [useWebGPU, setUseWebGPU] = useState<boolean | null>(null);

  // Check for WebGPU support on mount
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

  // While checking, show loading
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

  // Render appropriate version
  if (useWebGPU) {
    return <LiteBriteWebGPU selectedColor={selectedColor} onColorSelect={setSelectedColor} />;
  }

  return <LiteBriteCanvas2D selectedColor={selectedColor} onColorSelect={setSelectedColor} />;
}
