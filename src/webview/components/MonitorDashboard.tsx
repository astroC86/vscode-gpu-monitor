import { parse } from 'papaparse';
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { webviewLogger as logger } from '../../shared/logger';


interface GPUData {
  timestamp: string;
  utilization: number;
  memory: number;
}

interface MemoryData {
  timestamp: string;
  usage: number;
  virtualUsage: number;
}


export class PostCat {
  parentId?: number | null
  categoryId = -1
  title = ''
  visible = true
  description = ''
  updateTime: Date = new Date()
  count = 0
  order?: number
  childCount = 0
  visibleChildCount = 0
  parent?: PostCat | null

  flattenParents(includeSelf: boolean): PostCat[] {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      let i: PostCat | null | undefined = this
      const result: PostCat[] = []
      while (i != null) {
          if (i !== this || includeSelf) result.unshift(i)
          if (i.parent !== null && i.parent !== undefined && !(i.parent instanceof PostCat))
              i.parent = Object.assign(new PostCat(), i.parent)
          i = i.parent
      }

      return result
  }
}

export type PostCatAddDto = {
  title: string
  visible: boolean
  description: string
}
export type PostCatUpdateDto = Pick<PostCat, 'categoryId' | 'description' | 'count' | 'title' | 'order' | 'visible'>


export namespace Webview.Cmd {
    export enum Ui {
        editPostCfg = 'editPostCfg',
        updateBreadcrumbs = 'updateBreadcrumbs',
        updateImageUploadStatus = 'updateImageUploadStatus',
        setFluentIconBaseUrl = 'setFluentIconBaseUrl',
        updateTheme = 'updateTheme',
        updateChildCategories = 'updateChildCategories',
    }

    export enum Ext {
        uploadPost = 'uploadPost',
        disposePanel = 'disposePanel',
        uploadImg = 'uploadImg',
        refreshPost = 'refreshPost',
        getChildCategories = 'getChildCategories',
    }

    export interface GetChildCategoriesPayload {
        parentId: number
    }

    export interface UpdateChildCategoriesPayload {
        parentId: number
        value: PostCat[]
    }

    export namespace Ing {
        export enum Ui {
            setAppState = 'setAppState',
            updateTheme = 'updateTheme',
        }

        export enum Ext {
            reload = 'reload',
            comment = 'comment',
        }

        export type CommentCmdPayload = {
            ingId: number
            atUser?: { id: number; displayName: string }
            parentCommentId?: number
            ingContent: string
        }
    }
}

export interface WebviewCommonCmd<T> {
    payload: T
    command: unknown
}

export interface IngWebviewUiCmd<T extends Record<string, unknown> = Record<string, unknown>>
    extends WebviewCommonCmd<T> {
    command: Webview.Cmd.Ing.Ui
}

export interface IngWebviewHostCmd<T extends Record<string, unknown> = Record<string, unknown>>
    extends WebviewCommonCmd<T> {
    command: Webview.Cmd.Ing.Ext
}

declare type VsCodeApi = {
    postMessage<T extends WebviewCommonCmd<unknown> = WebviewCommonCmd<{}>>(message: Object | T): any
}

declare function acquireVsCodeApi(): VsCodeApi

const MonitorDashboard = () => {
  const [gpuData, setGpuData] = useState<GPUData[]>([]);
  const [memoryData, setMemoryData] = useState<MemoryData[]>([]);
  const [gpuPath, setGpuPath] = useState('');
  const [memoryPath, setMemoryPath] = useState('');
  const [gpuLastPosition, setGpuLastPosition] = useState(0);
  const [memoryLastPosition, setMemoryLastPosition] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const maxDataPoints = 100;
  const vscode = acquireVsCodeApi();

  useEffect(() => {
    logger.log('Setting up message listener');
    
    const handleMessage = (event: MessageEvent) => {
      const handleUpdate = (message: any) => {
        if (message.type === 'gpu') {
          setGpuLastPosition(message.lastPosition);
        } else if (message.type === 'memory') {
          setMemoryLastPosition(message.lastPosition);
        }
        parseNewData(message.data, message.type);
      };
  
        const message = event.data;
        logger.log(`Received message: ${JSON.stringify(message)}`);
        
        try {
            switch (message.command) {
                case 'update':
                    if (message.type === 'gpu' && message.data) {
                        logger.log(`Updating GPU data: ${JSON.stringify(message.data)}`);
                        setGpuData(current => {
                            const newData = [...current, message.data];
                            return newData.slice(-maxDataPoints);
                        });
                    } else if (message.type === 'memory' && message.data) {
                        logger.log(`Updating memory data: ${JSON.stringify(message.data)}`);
                        setMemoryData(current => {
                            const newData = [...current, message.data];
                            return newData.slice(-maxDataPoints);
                        });
                    }
                    break;
                case 'clear':
                  logger.log('Clearing data');
                  setGpuData([]);
                  setMemoryData([]);
                  break;
                case 'initialData':
                  logger.log('Received initial data');
                  setGpuPath(message.gpuPath);
                  setMemoryPath(message.memoryPath);
                  parseInitialData(message.gpu, 'gpu');
                  parseInitialData(message.memory, 'memory');
                  break;
                case 'update':
                  handleUpdate(message);
                  break;
                case 'error':
                  logger.error(`Error received: ${message.message}`);
                  setIsMonitoring(false);
                  break;
            }
        } catch (error) {
          logger.error(error instanceof Error ? error : new Error(String(error)));
        }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  useEffect(() => {
    let intervalId: any;
  
    if (isMonitoring) {
      intervalId = setInterval(() => {
        logger.log('Requesting new data');
        if (gpuPath) {
          vscode.postMessage({
            command: 'getNewData',
            path: gpuPath,
            lastPosition: gpuLastPosition,
            type: 'gpu'
          });
        }
        if (memoryPath) {
          vscode.postMessage({
            command: 'getNewData',
            path: memoryPath,
            lastPosition: memoryLastPosition,
            type: 'memory'
          });
        }
      }, 5000);
    } else {
      clearInterval(intervalId);
    }
  
    return () => clearInterval(intervalId);
  }, [isMonitoring, gpuPath, memoryPath, gpuLastPosition, memoryLastPosition]);

  const parseInitialData = (fileContent: string, type: 'gpu' | 'memory') => {
    logger.log(`Parsing initial data for ${type}`);
    parse(fileContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          logger.error(`Error parsing CSV: ${JSON.stringify(results.errors)}`);
          return;
        }
        logger.log(`Parsed initial data for ${type}: ${results.data.length} rows`);
        const transformedData = results.data.map((row: any) => transformData(row, type)).filter((row): row is GPUData | MemoryData => row !== null);
        if (type === 'gpu') {
          setGpuData(transformedData as GPUData[]);
        } else {
          setMemoryData(transformedData as MemoryData[]);
        }
      },
      error: (error: Error) => {
        logger.error(`Error parsing initial ${type} data: ${error.message}`);
      }
    });
  };

  const parseNewData = (newContent: string, type: 'gpu' | 'memory') => {
    if (!newContent) return;
  
    parse(newContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          logger.error(`Error parsing CSV: ${JSON.stringify(results.errors)}`);
          return;
        }
  
        const transformedData = results.data.map((row: any) => transformData(row, type)).filter((row): row is GPUData | MemoryData => row !== null);
        if (type === 'gpu') {
          setGpuData(current => {
            const newData = [...current, ...(transformedData as GPUData[])];
            return newData.slice(-maxDataPoints);
          });
        } else {
          setMemoryData(current => {
            const newData = [...current, ...(transformedData as MemoryData[])];
            return newData.slice(-maxDataPoints);
          });
        }
      },
      error: (error: Error) => {
        logger.error(`Error parsing new ${type} data: ${error.message}`);
      }
    });
  };

  const transformData = (row: any, type: 'gpu' | 'memory'): GPUData | MemoryData | null => {
    if (type === 'gpu') {
      if (row.Timestamp && row.GPU_Utilization && row.Memory_Used && row.Memory_Total) {
        return {
          timestamp: row.Timestamp,
          utilization: row.GPU_Utilization,
          memory: (row.Memory_Used / row.Memory_Total) * 100
        };
      }
    } else if (type === 'memory') {
      if (row.Timestamp && row.RSS_KB && row.VSZ_KB) {
        return {
          timestamp: row.Timestamp,
          usage: row.RSS_KB / 1024,
          virtualUsage: row.VSZ_KB / 1024
        };
      }
    }
    logger.error(`Invalid data format for ${type}: ${JSON.stringify(row)}`);
    return null;
  };

  const startMonitoring = async () => {
    setGpuData([]);
    setMemoryData([]);
    setGpuLastPosition(0);
    setMemoryLastPosition(0);
  
    vscode.postMessage({
      command: 'getInitialData',
      gpuPath,
      memoryPath
    });
  
    setIsMonitoring(true);
    logger.log('Started monitoring');
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    logger.log('Stopped monitoring');
  };

  const PathInput = () => (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label htmlFor="gpuPath" className="block text-sm font-medium text-gray-700 mb-2">
            GPU Stats File Path
          </label>
          <input
            id="gpuPath"
            type="text"
            value={gpuPath || ''}
            onChange={(e) => setGpuPath(e.target.value)}
            placeholder="/path/to/gpu_stats.log"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isMonitoring}
          />
        </div>
        <div>
          <label htmlFor="memoryPath" className="block text-sm font-medium text-gray-700 mb-2">
            Memory Stats File Path
          </label>
          <input
            id="memoryPath"
            type="text"
            value={memoryPath || ''}
            onChange={(e) => setMemoryPath(e.target.value)}
            placeholder="/path/to/train_memory.log"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isMonitoring}
          />
        </div>
        <div>
          {!isMonitoring ? (
            <button
              onClick={startMonitoring}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Monitoring
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Stop Monitoring
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const latestGPU = gpuData[gpuData.length - 1];
  const latestMemory = memoryData[memoryData.length - 1];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">GPU & Memory Monitor</h1>
        
        <PathInput />
        
        {isMonitoring && (
          <>
            {/* Current Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-white shadow-md">
                <h3 className="text-lg font-semibold mb-2">GPU Stats</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm text-gray-600">Utilization:</div>
                  <div className="text-sm font-medium">
                    {latestGPU ? `${latestGPU.utilization.toFixed(1)}%` : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Memory:</div>
                  <div className="text-sm font-medium">
                    {latestGPU ? `${latestGPU.memory.toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white shadow-md">
                <h3 className="text-lg font-semibold mb-2">Memory Stats</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-sm text-gray-600">Resident:</div>
                  <div className="text-sm font-medium">
                    {latestMemory ? `${latestMemory.usage.toFixed(1)} MB` : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Virtual:</div>
                  <div className="text-sm font-medium">
                    {latestMemory ? `${latestMemory.virtualUsage.toFixed(1)} MB` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="space-y-8">
              <div className="w-full">
                <h2 className="text-2xl font-semibold mb-4">Memory Usage</h2>
                <div className="p-4 rounded-lg bg-white shadow-md">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={memoryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                      <XAxis 
                        dataKey="timestamp" 
                        label={{ value: 'Time', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis label={{ value: 'MB', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                        labelClassName="font-medium"
                        formatter={(value: number) => `${value.toFixed(1)} MB`}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line
                        type="monotone"
                        dataKey="usage"
                        name="Resident Memory (MB)"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="virtualUsage"
                        name="Virtual Memory (MB)"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MonitorDashboard;