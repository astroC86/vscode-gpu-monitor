
export interface GPUData {
    timestamp: string;
    utilization: number;
    memory: number;
  }
  
  export interface MemoryData {
    timestamp: string;
    usage: number;
    virtualUsage: number;
  }
  
  export interface VSCodeMessage {
    command: 'update' | 'clear' | 'initialData' | 'getInitialData' | 'getNewData' | 'error';
    type?: 'gpu' | 'memory';
    data?: GPUData | MemoryData;
    gpu?: string;
    memory?: string;
    gpuPath?: string;
    memoryPath?: string;
    lastPosition?: number;
    path?: string;
    text?: string;
    gpuLastPosition?: number;
    memoryLastPosition?: number;
    message?: string;
  }
       
  declare global {
    interface Window {
      acquireVsCodeApi(): {
        postMessage(message: unknown): void;
        setState(state: unknown): void;
        getState(): unknown;
      };
    }
  }