import { useEffect, useRef, useState, useCallback } from 'react';
import shaderCode from '../shaders/litebrite.wgsl?raw';

const PEG_SPACING = 32;

export interface UseLiteBriteGPUOptions {
  boardWidth: number;
  boardHeight: number;
  glowIntensity?: number;
  ambientBrightness?: number;
  pegBrightness?: number;
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
  ambientBrightness = 1.0,
  pegBrightness = 1.0,
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
  const canvasFormatRef = useRef<GPUTextureFormat>('bgra8unorm');
  const renderPipelineRef = useRef<GPURenderPipeline | null>(null);
  const blitBindGroupRef = useRef<GPUBindGroup | null>(null);
  const samplerRef = useRef<GPUSampler | null>(null);

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

  //  add WebGPU extensions
        const requiredFeatures: GPUFeatureName[] = [];
        if (adapter.features.has('float32-filterable')) {
            requiredFeatures.push('float32-filterable');
        } else {
            console.log("Device does not support 'float32-filterable'");
        }
        if (adapter.features.has('float32-blendable')) {
            requiredFeatures.push('float32-blendable');
        } else {
            console.log("Device does not support 'float32-blendable'.");
        }
        if (adapter.features.has('clip-distances')) {
            requiredFeatures.push('clip-distances');
        } else {
            console.log("Device does not support 'clip-distances'.");
        }
        if (adapter.features.has('depth32float-stencil8')) {
            requiredFeatures.push('depth32float-stencil8');
        } else {
            console.log("Device does not support 'depth32float-stencil8'.");
        }
        if (adapter.features.has('dual-source-blending')) {
            requiredFeatures.push('dual-source-blending');
        } else {
            console.log("Device does not support 'dual-source-blending'.");
        }
                if (adapter.features.has('subgroups')) {
            requiredFeatures.push('subgroups');
        } else {
            console.log("Device does not support 'subgroups'.");
        }
        if (adapter.features.has('texture-component-swizzle')) {
            requiredFeatures.push('texture-component-swizzle');
        } else {
            console.log("Device does not support 'texture-component-swizzle'.");
        }
        if (adapter.features.has('shader-f16')) {
            requiredFeatures.push('shader-f16');
        } else {
            console.log("Device does not support 'shader-f16'.");
        }
        
        const device = await adapter.requestDevice({
            requiredFeatures,
        });
      
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
      canvasFormatRef.current = format;
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
        size: 32, // Increased size to accommodate new params (width, height, time, glowIntensity, ambientBrightness, pegBrightness)
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

      // Create render texture with the same format as canvas for copy compatibility
      const renderTexture = device.createTexture({
        size: { width: pixelWidth, height: pixelHeight },
        format: canvasFormatRef.current,
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      renderTextureRef.current = renderTexture;

      // Create sampler for texture sampling
      const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });
      samplerRef.current = sampler;

      // Create fullscreen quad shader for blitting texture to canvas
      const blitShaderCode = `
        @vertex
        fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, -1.0),
            vec2<f32>(1.0, 1.0)
          );
          return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        }

        @group(0) @binding(0) var texSampler: sampler;
        @group(0) @binding(1) var tex: texture_2d<f32>;

        @fragment
        fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
          let texSize = textureDimensions(tex);
          let uv = coord.xy / vec2<f32>(f32(texSize.x), f32(texSize.y));
          return textureSample(tex, texSampler, uv);
        }
      `;

      const blitShaderModule = device.createShaderModule({
        code: blitShaderCode,
      });

      // Create render pipeline for blitting
      const renderPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: blitShaderModule,
          entryPoint: 'vs_main',
        },
        fragment: {
          module: blitShaderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: format,
          }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });
      renderPipelineRef.current = renderPipeline;

      // Create bind group for blitting
      const blitBindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: renderTexture.createView() },
        ],
      });
      blitBindGroupRef.current = blitBindGroup;

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
      const renderPipeline = renderPipelineRef.current;
      const blitBindGroup = blitBindGroupRef.current;

      if (!device || !context || !pipeline || !bindGroup || !paramsBuffer || !boardStateBuffer || !outputBuffer || !renderTexture || !renderPipeline || !blitBindGroup) {
        return;
      }

      const time = (performance.now() - startTimeRef.current) / 1000;

      // Update params
      const paramsData = new ArrayBuffer(32);
      const paramsView = new DataView(paramsData);
      paramsView.setUint32(0, pixelWidth, true);
      paramsView.setUint32(4, pixelHeight, true);
      paramsView.setFloat32(8, time, true);
      paramsView.setFloat32(12, glowIntensity, true);
      paramsView.setFloat32(16, ambientBrightness, true);
      paramsView.setFloat32(20, pegBrightness, true);
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

      // Render texture to canvas using a fullscreen quad
      const canvasTexture = context.getCurrentTexture();
      const renderPassEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: canvasTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        }],
      });

      renderPassEncoder.setPipeline(renderPipeline);
      renderPassEncoder.setBindGroup(0, blitBindGroup);
      renderPassEncoder.draw(6, 1, 0, 0);
      renderPassEncoder.end();

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
