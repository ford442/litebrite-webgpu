# Lite Brite WebGPU

An interactive Lite Brite display mimicking the classic toy, built as a React app using WebGPU compute shaders for rendering glowing pegs.

## Features

- 🎨 **8 Classic Colors** - Red, Orange, Yellow, Green, Blue, Pink, White, and Purple pegs
- ✨ **Glowing Effects** - WebGPU compute shader creates realistic glowing peg effects with gentle pulsing animations
- 🖱️ **Interactive** - Click or drag to place pegs on the board
- 🧹 **Eraser Tool** - Remove individual pegs
- 🗑️ **Clear Board** - Reset the entire board
- 📱 **Touch Support** - Works on touch devices

## Requirements

- A modern browser with WebGPU support (Chrome 113+, Edge 113+, or other compatible browsers)
- For development: Node.js 18+

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## How to Use

1. **Select a Color** - Click on a colored peg in the palette at the bottom
2. **Place Pegs** - Click or drag on the dark board to place pegs
3. **Erase Pegs** - Select the eraser (✕) and click on pegs to remove them
4. **Clear Board** - Click the "Clear Board" button to start fresh

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **WebGPU** - Hardware-accelerated compute shaders for rendering

## WebGPU Compute Shader

The glowing peg effects are rendered using a WebGPU compute shader that:
- Processes the board state (peg positions and colors)
- Calculates distance from pixel to peg center
- Applies glow falloff and inner highlights
- Adds subtle time-based pulsing animation

## Browser Support

WebGPU is a relatively new API. Check [caniuse.com](https://caniuse.com/webgpu) for current browser support.

If WebGPU is not available, the app displays a helpful error message.

## License

MIT
