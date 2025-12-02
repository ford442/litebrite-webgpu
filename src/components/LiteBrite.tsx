import type React from 'react';
import { useCallback, useState } from 'react';
import { useLiteBriteGPU } from '../hooks/useLiteBriteGPU';
import { ColorPalette } from './ColorPalette';
import './LiteBrite.css';

// Board dimensions in pegs (original Lite Brite was roughly 18x13)
const BOARD_WIDTH = 32;
const BOARD_HEIGHT = 24;
const PEG_SPACING = 16;

export function LiteBrite() {
  const [selectedColor, setSelectedColor] = useState(1); // Default to red
  const [isMouseDown, setIsMouseDown] = useState(false);

  const {
    canvasRef,
    isSupported,
    isReady,
    error,
    setPixel,
    clearBoard,
  } = useLiteBriteGPU({
    boardWidth: BOARD_WIDTH,
    boardHeight: BOARD_HEIGHT,
    glowIntensity: 1.3,
  });

  const handleCanvasInteraction = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ('touches' in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor(((clientX - rect.left) * scaleX) / PEG_SPACING);
      const y = Math.floor(((clientY - rect.top) * scaleY) / PEG_SPACING);

      if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
        setPixel(x, y, selectedColor);
      }
    },
    [canvasRef, setPixel, selectedColor]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsMouseDown(true);
      handleCanvasInteraction(e);
    },
    [handleCanvasInteraction]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isMouseDown) {
        handleCanvasInteraction(e);
      }
    },
    [isMouseDown, handleCanvasInteraction]
  );

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      handleCanvasInteraction(e);
    },
    [handleCanvasInteraction]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      handleCanvasInteraction(e);
    },
    [handleCanvasInteraction]
  );

  const handleClear = useCallback(() => {
    clearBoard();
  }, [clearBoard]);

  if (!isSupported) {
    return (
      <div className="litebrite-error">
        <h2>WebGPU Not Supported</h2>
        <p>{error || 'Your browser does not support WebGPU. Please try using Chrome or Edge with WebGPU enabled.'}</p>
      </div>
    );
  }

  return (
    <div className="litebrite-container">
      <header className="litebrite-header">
        <h1 className="litebrite-title">
          <span className="lite">LITE</span>
          <span className="brite">BRITE</span>
        </h1>
        <p className="litebrite-subtitle">WebGPU Edition</p>
      </header>

      <div className="litebrite-frame">
        <div className="litebrite-screen">
          <canvas
            ref={canvasRef}
            width={BOARD_WIDTH * PEG_SPACING}
            height={BOARD_HEIGHT * PEG_SPACING}
            className="litebrite-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          />
          {!isReady && (
            <div className="litebrite-loading">
              <span>Loading WebGPU...</span>
            </div>
          )}
        </div>
      </div>

      <div className="litebrite-controls">
        <ColorPalette
          selectedColor={selectedColor}
          onColorSelect={setSelectedColor}
        />
        <button className="litebrite-clear-btn" onClick={handleClear}>
          Clear Board
        </button>
      </div>

      <div className="litebrite-instructions">
        <p>Click or drag on the board to place pegs</p>
        <p>Select a color from the palette below</p>
      </div>
    </div>
  );
}
