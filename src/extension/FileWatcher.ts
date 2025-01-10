import * as vscode from 'vscode';
import * as fs from 'fs';
import { parse } from 'csv-parse';
import { MonitorPanel } from './MonitorPanel';

export class FileWatcher {
    private gpuWatcher: fs.FSWatcher | undefined;
    private memoryWatcher: fs.FSWatcher | undefined;
    private updateInterval: NodeJS.Timeout | undefined;
    private lastProcessedPositions: { [key: string]: number } = {};

    constructor(
        private readonly monitorPanel: MonitorPanel,
        private readonly gpuStatsPath: string,
        private readonly memoryStatsPath: string
    ) {
        this.startWatching();
    }

    private startWatching() {
        const config = vscode.workspace.getConfiguration('gpuMonitor');
        const interval = config.get<number>('updateInterval', 5000);

        try {
            // Validate file paths
            if (!fs.existsSync(this.gpuStatsPath)) {
                throw new Error(`GPU stats file not found: ${this.gpuStatsPath}`);
            }
            if (!fs.existsSync(this.memoryStatsPath)) {
                throw new Error(`Memory stats file not found: ${this.memoryStatsPath}`);
            }

            // Watch for GPU stats file changes
            this.gpuWatcher = fs.watch(this.gpuStatsPath, (_eventType, filename) => {
                if (filename) {
                    this.processFile(this.gpuStatsPath, this.transformGpuData.bind(this), 'gpu');
                }
            });

            // Watch for memory stats file changes
            this.memoryWatcher = fs.watch(this.memoryStatsPath, (_eventType, filename) => {
                if (filename) {
                    this.processFile(this.memoryStatsPath, this.transformMemoryData.bind(this), 'memory');
                }
            });

            // Initial processing
            this.processFile(this.gpuStatsPath, this.transformGpuData.bind(this), 'gpu');
            this.processFile(this.memoryStatsPath, this.transformMemoryData.bind(this), 'memory');

            // Set up periodic updates
            this.updateInterval = setInterval(() => {
                this.processFile(this.gpuStatsPath, this.transformGpuData.bind(this), 'gpu');
                this.processFile(this.memoryStatsPath, this.transformMemoryData.bind(this), 'memory');
            }, interval);

        } catch (err) {
            const error = err as Error;
            vscode.window.showErrorMessage(`Failed to start monitoring: ${error.message}`);
            throw error; // Re-throw to signal initialization failure
        }
    }

    private async processFile(filePath: string, transformFn: (row: any) => any, type: 'gpu' | 'memory') {
        try {
            const stats = fs.statSync(filePath);
            const currentSize = stats.size;
            const lastPosition = this.lastProcessedPositions[filePath] || Math.max(0, currentSize - 1024 * 1024); // Start from last 1MB if new file
            
            if (currentSize <= lastPosition) {
                return;
            }

            const stream = fs.createReadStream(filePath, { start: lastPosition });
            const parser = parse({
                columns: true,
                skip_empty_lines: true,
                trim: true
            });

            stream.pipe(parser);

            parser.on('readable', () => {
                let record;
                while ((record = parser.read()) !== null) {
                    try {
                        const transformedData = transformFn(record);
                        this.monitorPanel.updateData({
                            command: 'update',
                            type: type,
                            data: transformedData
                        });
                    } catch (err) {
                        console.error('Error transforming record:', err);
                        // Continue processing other records
                    }
                }
            });

            parser.on('end', () => {
                this.lastProcessedPositions[filePath] = currentSize;
            });

            parser.on('error', (err) => {
                console.error('Error parsing CSV:', err);
                vscode.window.showErrorMessage(`Error parsing ${type} stats file: ${err.message}`);
            });

            // Handle stream errors
            stream.on('error', (err) => {
                console.error('Error reading file:', err);
                vscode.window.showErrorMessage(`Error reading ${type} stats file: ${err.message}`);
            });

        } catch (err) {
            const error = err as Error;
            console.error('Error processing file:', error);
            vscode.window.showErrorMessage(`Error processing ${type} stats file: ${error.message}`);
        }
    }

    private transformGpuData(row: any) {
        // Validate required fields
        if (!row.Timestamp || !row.GPU_Utilization || !row.Memory_Used || !row.Memory_Total) {
            throw new Error('Missing required fields in GPU data');
        }

        const timestamp = new Date(row.Timestamp);
        if (isNaN(timestamp.getTime())) {
            throw new Error('Invalid timestamp in GPU data');
        }

        const utilization = parseFloat(row.GPU_Utilization);
        const memoryUsed = parseFloat(row.Memory_Used);
        const memoryTotal = parseFloat(row.Memory_Total);

        if (isNaN(utilization) || isNaN(memoryUsed) || isNaN(memoryTotal)) {
            throw new Error('Invalid numeric values in GPU data');
        }

        return {
            timestamp: timestamp.toLocaleTimeString(),
            utilization: utilization,
            memory: (memoryUsed / memoryTotal) * 100
        };
    }

    private transformMemoryData(row: any) {
        // Validate required fields
        if (!row.Timestamp || !row.RSS_KB || !row.VSZ_KB) {
            throw new Error('Missing required fields in memory data');
        }

        const timestamp = new Date(row.Timestamp);
        if (isNaN(timestamp.getTime())) {
            throw new Error('Invalid timestamp in memory data');
        }

        const rssKB = parseFloat(row.RSS_KB);
        const vszKB = parseFloat(row.VSZ_KB);

        if (isNaN(rssKB) || isNaN(vszKB)) {
            throw new Error('Invalid numeric values in memory data');
        }

        return {
            timestamp: timestamp.toLocaleTimeString(),
            usage: rssKB / 1024, // Convert to MB
            virtualUsage: vszKB / 1024 // Convert to MB
        };
    }

    public dispose() {
        try {
            if (this.gpuWatcher) {
                this.gpuWatcher.close();
                this.gpuWatcher = undefined;
            }
            if (this.memoryWatcher) {
                this.memoryWatcher.close();
                this.memoryWatcher = undefined;
            }
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = undefined;
            }
            this.lastProcessedPositions = {};
        } catch (err) {
            console.error('Error during cleanup:', err);
        }
    }
}