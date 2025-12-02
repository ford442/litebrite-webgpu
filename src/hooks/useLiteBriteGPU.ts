import { useEffect, useRef, useState, useCallback } from 'react';
import shaderCode from '../shaders/litebrite.wgsl?raw';

const PEG_SPACING = 16;

export interface UseLiteBriteGPUOptions {
  boardWidth: number;
  boardHeight: number;
  glowIntensity?: number;
}

export interface UseLiteBriteGPUResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isSupported: boolean;
  isReady: boolean;
  error: string | null;
  setPixel: (x: number, y: number, colorIndex: number) => void;
  setBoard: (data: Uint32Array) => void;
  clearBoard: () => void;
  getBoardState: () => Uint32Array;
}

export function useLiteBriteGPU({
  boardWidth,
  boardHeight,
  glowIntensity = 1.2,
}: UseLiteBriteGPUOptions): UseLiteBriteGPUResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GPU resources
  const deviceRef = useRef<GPUDevice | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const pipelineRef = useRef<GPUComputePipeline | null>(null);
  const bindGroupRef = useRef<GPUBindGroup | null>(null);
  const paramsBufferRef = useRef<GPUBuffer | null>(null);
  const boardStateBufferRef = useRef<GPUBuffer | null>(null);
  const outputBufferRef = useRef<GPUBuffer | null>(null);
  const renderTextureRef = useRef<GPUTexture | null>(null);

  // Board state (stored in CPU memory for easy modification)
  const boardStateRef = useRef<Uint32Array>(new Uint32Array(boardWidth * boardHeight));
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const pixelWidth = boardWidth * PEG_SPACING;
  const pixelHeight = boardHeight * PEG_SPACING;

  // Initialize WebGPU
  useEffect(() => {
    startTimeRef.current = performance.now();

    const initWebGPU = async () => {
      if (!navigator.gpu) {
        setIsSupported(false);
        setError('WebGPU is not supported in this browser');
        return;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        setIsSupported(false);
        setError('Failed to get WebGPU adapter');
        return;
      }

      const device = await adapter.requestDevice();
      deviceRef.current = device;

      device.lost.then((info) => {
        console.error('WebGPU device was lost:', info.message);
        setError(`GPU device lost: ${info.message}`);
      });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('webgpu');
      if (!context) {
        setError('Failed to get WebGPU context');
        return;
      }
      contextRef.current = context;

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      });

      // Create compute shader module
      const shaderModule = device.createShaderModule({
        code: shaderCode,
      });

      // Create bind group layout
      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'read-only-storage' },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' },
          },
        ],
      });

      // Create compute pipeline
      const pipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        }),
        compute: {
          module: shaderModule,
          entryPoint: 'main',
        },
      });
      pipelineRef.current = pipeline;

      // Create params uniform buffer
      const paramsBuffer = device.createBuffer({
        size: 16, // 4 * 4 bytes (width, height, time, glowIntensity)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      paramsBufferRef.current = paramsBuffer;

      // Create board state buffer
      const boardStateBuffer = device.createBuffer({
        size: boardWidth * boardHeight * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      boardStateBufferRef.current = boardStateBuffer;

      // Create output buffer
      const outputBuffer = device.createBuffer({
        size: pixelWidth * pixelHeight * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      outputBufferRef.current = outputBuffer;

      // Create bind group
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: paramsBuffer } },
          { binding: 1, resource: { buffer: boardStateBuffer } },
          { binding: 2, resource: { buffer: outputBuffer } },
        ],
      });
      bindGroupRef.current = bindGroup;

      // Create render texture
      const renderTexture = device.createTexture({
        size: { width: pixelWidth, height: pixelHeight },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      renderTextureRef.current = renderTexture;

      setIsReady(true);
    };

    initWebGPU().catch((err) => {
      console.error('WebGPU initialization failed:', err);
      setError(`Initialization failed: ${err.message}`);
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      deviceRef.current?.destroy();
    };
  }, [boardWidth, boardHeight, pixelWidth, pixelHeight]);

  // Render loop
  useEffect(() => {
    if (!isReady) return;

    const render = () => {
      const device = deviceRef.current;
      const context = contextRef.current;
      const pipeline = pipelineRef.current;
      const bindGroup = bindGroupRef.current;
      const paramsBuffer = paramsBufferRef.current;
      const boardStateBuffer = boardStateBufferRef.current;
      const outputBuffer = outputBufferRef.current;
      const renderTexture = renderTextureRef.current;

      if (!device || !context || !pipeline || !bindGroup || !paramsBuffer || !boardStateBuffer || !outputBuffer || !renderTexture) {
        return;
      }

      const time = (performance.now() - startTimeRef.current) / 1000;

      // Update params
      const paramsData = new ArrayBuffer(16);
      const paramsView = new DataView(paramsData);
      paramsView.setUint32(0, pixelWidth, true);
      paramsView.setUint32(4, pixelHeight, true);
      paramsView.setFloat32(8, time, true);
      paramsView.setFloat32(12, glowIntensity, true);
      device.queue.writeBuffer(paramsBuffer, 0, paramsData);

      // Update board state - create a copy to ensure we have a proper ArrayBuffer
      const boardData = new Uint32Array(boardStateRef.current);
      device.queue.writeBuffer(boardStateBuffer, 0, boardData);

      // Dispatch compute shader
      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(
        Math.ceil(pixelWidth / 8),
        Math.ceil(pixelHeight / 8)
      );
      passEncoder.end();

      // Copy output buffer to texture
      commandEncoder.copyBufferToTexture(
        { buffer: outputBuffer, bytesPerRow: pixelWidth * 4, rowsPerImage: pixelHeight },
        { texture: renderTexture },
        { width: pixelWidth, height: pixelHeight }
      );

      // Copy texture to canvas
      const canvasTexture = context.getCurrentTexture();
      commandEncoder.copyTextureToTexture(
        { texture: renderTexture },
        { texture: canvasTexture },
        { width: pixelWidth, height: pixelHeight }
      );

      device.queue.submit([commandEncoder.finish()]);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isReady, pixelWidth, pixelHeight, glowIntensity]);

  const setPixel = useCallback((x: number, y: number, colorIndex: number) => {
    // console.log(`GPU setPixel: ${x}, ${y}, ${colorIndex}`); // Debug
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
    isSupported,
    isReady,
    error,
    setPixel,
    setBoard,
    clearBoard,
    getBoardState,
  };
}
