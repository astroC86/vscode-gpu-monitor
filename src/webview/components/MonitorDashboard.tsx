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

const MonitorDashboard = () => {
  const [gpuData, setGpuData] = useState<GPUData[]>([]);
  const [memoryData, setMemoryData] = useState<MemoryData[]>([]);
  const [gpuPath, setGpuPath] = useState('');
  const [memoryPath, setMemoryPath] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const maxDataPoints = 100;
  const vscode = acquireVsCodeApi();

  useEffect(() => {
    logger.log('Setting up message listener');
    
    const handleMessage = (event: MessageEvent) => {
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
            }
        } catch (error) {
            logger.error(error instanceof Error ? error : new Error(String(error)));
        }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const startMonitoring = () => {
    if (!gpuPath || !memoryPath) {
        logger.error('Missing file paths');
        vscode.postMessage({
            command: 'error',
            text: 'Please provide both file paths'
        });
        return;
    }

    logger.log(`Starting monitoring with paths: GPU=${gpuPath}, Memory=${memoryPath}`);
    vscode.postMessage({
        command: 'startMonitoring',
        gpuPath,
        memoryPath
    });
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    vscode.postMessage({
      command: 'stopMonitoring'
    });
    setIsMonitoring(false);
    setGpuData([]);
    setMemoryData([]);
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
            value={gpuPath}
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
            value={memoryPath}
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
                <h2 className="text-2xl font-semibold mb-4">GPU Utilization</h2>
                <div className="p-4 rounded-lg bg-white shadow-md">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={gpuData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                      <XAxis 
                        dataKey="timestamp" 
                        label={{ value: 'Time', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                        labelClassName="font-medium"
                        formatter={(value: number) => `${value.toFixed(1)}%`}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line
                        type="monotone"
                        dataKey="utilization"
                        name="GPU Utilization %"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="memory"
                        name="Memory Usage %"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

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