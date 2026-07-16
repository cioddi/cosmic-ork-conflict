// WebGPU type definitions
declare global {
  interface Navigator {
    gpu?: GPU;
  }

  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  }

  interface GPUAdapter {
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
  }

  interface GPUDevice {
    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
    createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
    createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
    queue: GPUQueue;
  }

  interface GPUQueue {
    writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: ArrayBuffer | ArrayBufferView): void;
    submit(commandBuffers: GPUCommandBuffer[]): void;
  }

  interface GPUShaderModule {}
  interface GPUBindGroupLayout {}
  interface GPUPipelineLayout {}
  interface GPUComputePipeline {}
  interface GPUBindGroup {}

  interface GPUBuffer {
    destroy(): void;
    mapAsync(mode: GPUMapModeFlags, offset?: number, size?: number): Promise<void>;
    getMappedRange(offset?: number, size?: number): ArrayBuffer;
    unmap(): void;
  }

  interface GPUCommandEncoder {
    beginComputePass(descriptor?: GPUComputePassDescriptor): GPUComputePassEncoder;
    copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void;
    finish(descriptor?: GPUCommandBufferDescriptor): GPUCommandBuffer;
  }

  interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup): void;
    dispatchWorkgroups(workgroupCountX: number, workgroupCountY?: number, workgroupCountZ?: number): void;
    end(): void;
  }

  interface GPUCommandBuffer {}

  enum GPUShaderStage {
    VERTEX = 1,
    FRAGMENT = 2,
    COMPUTE = 4,
  }

  enum GPUBufferUsage {
    MAP_READ = 1,
    MAP_WRITE = 2,
    COPY_SRC = 4,
    COPY_DST = 8,
    INDEX = 16,
    VERTEX = 32,
    UNIFORM = 64,
    STORAGE = 128,
    INDIRECT = 256,
    QUERY_RESOLVE = 512,
  }

  enum GPUMapMode {
    READ = 1,
    WRITE = 2,
  }

  type GPUMapModeFlags = number;

  interface GPURequestAdapterOptions {
    powerPreference?: 'low-power' | 'high-performance';
    forceFallbackAdapter?: boolean;
  }

  interface GPUDeviceDescriptor {
    label?: string;
    requiredFeatures?: string[];
    requiredLimits?: Record<string, number>;
  }

  interface GPUShaderModuleDescriptor {
    label?: string;
    code: string;
  }

  interface GPUBindGroupLayoutDescriptor {
    label?: string;
    entries: GPUBindGroupLayoutEntry[];
  }

  interface GPUBindGroupLayoutEntry {
    binding: number;
    visibility: number;
    buffer?: GPUBufferBindingLayout;
    sampler?: any;
    texture?: any;
    storageTexture?: any;
  }

  interface GPUBufferBindingLayout {
    type?: 'uniform' | 'storage' | 'read-only-storage';
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
  }

  interface GPUPipelineLayoutDescriptor {
    label?: string;
    bindGroupLayouts: GPUBindGroupLayout[];
  }

  interface GPUComputePipelineDescriptor {
    label?: string;
    layout: GPUPipelineLayout | 'auto';
    compute: GPUProgrammableStage;
  }

  interface GPUProgrammableStage {
    module: GPUShaderModule;
    entryPoint: string;
    constants?: Record<string, number>;
  }

  interface GPUBufferDescriptor {
    label?: string;
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
  }

  interface GPUBindGroupDescriptor {
    label?: string;
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
  }

  interface GPUBindGroupEntry {
    binding: number;
    resource: GPUBufferBinding | GPUSampler | GPUTextureView;
  }

  interface GPUBufferBinding {
    buffer: GPUBuffer;
    offset?: number;
    size?: number;
  }

  interface GPUSampler {}
  interface GPUTextureView {}

  interface GPUCommandEncoderDescriptor {
    label?: string;
  }

  interface GPUComputePassDescriptor {
    label?: string;
  }

  interface GPUCommandBufferDescriptor {
    label?: string;
  }
}

export {};