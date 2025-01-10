
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
    command: 'update' | 'clear';
    type?: 'gpu' | 'memory';
    data?: GPUData | MemoryData;
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