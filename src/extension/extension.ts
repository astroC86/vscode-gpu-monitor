import * as vscode from 'vscode';
import * as fs from 'fs';
import { MonitorPanel } from './MonitorPanel';
import { Logger } from '../shared/logger';
import { TextDecoder } from 'util';

export function activate(context: vscode.ExtensionContext) {
    Logger.init();
    Logger.log('Extension activating');

    let currentPanel: MonitorPanel | undefined = undefined;
    const decoder = new TextDecoder('utf-8');
    
    let disposable = vscode.commands.registerCommand('vscode-gpu-monitor.start', async () => {
        Logger.log('Start command executed');
        
        if (currentPanel) {
            Logger.log('Reusing existing panel');
            currentPanel.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        currentPanel = new MonitorPanel(context.extensionUri);
        
        // Handle messages from the webview
        currentPanel.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'log':
                        if (message.level === 'error') {
                            Logger.error(new Error(message.text), 'Webview');
                        } else {
                            Logger.log(message.text, 'Webview');
                        }
                        break;
                        
                    case 'getInitialData': {
                        Logger.log('getInitialData command received', 'Webview');
                        try {
                            const gpuData = await readFileContent(message.gpuPath);
                            const memoryData = await readFileContent(message.memoryPath);
                            currentPanel!.updateData({
                                command: 'initialData',
                                gpu: gpuData,
                                memory: memoryData,
                                gpuPath: message.gpuPath,
                                memoryPath: message.memoryPath
                            });
                        } catch (error) {
                            Logger.error(error as Error, 'Extension');
                            vscode.window.showErrorMessage(`Failed to read initial data: ${(error as Error).message}`);
                        }
                        break;
                    }
                        
                    case 'getNewData': {
                        try {
                            const data = await readNewData(message.path, message.lastPosition);
                            currentPanel!.updateData({
                                command: 'update',
                                type: message.type,
                                data: data,
                                lastPosition: message.lastPosition + data.length,
                                path: message.path
                            });
                        } catch (error) {
                            Logger.error(error as Error, 'Extension');
                            vscode.window.showErrorMessage(`Failed to read new data from ${message.path}: ${(error as Error).message}`);
                        }
                        break;
                    }
                        
                    case 'error':
                        Logger.error(new Error(message.text), 'Webview');
                        vscode.window.showErrorMessage(`Webview error: ${message.text}`);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        async function readFileContent(filePath: string): Promise<string> {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            return decoder.decode(fileContent);
        }
    
        async function readNewData(filePath: string, lastPosition: number): Promise<string> {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
    
            const stats = fs.statSync(filePath);
            const currentSize = stats.size;
    
            if (currentSize <= lastPosition) {
                return '';
            }
    
            const file = fs.createReadStream(filePath, { start: lastPosition, encoding: 'utf8' });
            let data = '';
            for await (const chunk of file) {
                data += chunk;
            }
            return data;
        }

        currentPanel.panel.onDidDispose(
            () => {
                Logger.log('Panel disposed');
                currentPanel = undefined;
            },
            null,
            context.subscriptions
        );

        // Show the output channel when starting
        Logger.show();
    });

    context.subscriptions.push(disposable);
    
    // Register cleanup
    context.subscriptions.push({
        dispose: () => {
            Logger.log('Extension deactivating');
            Logger.dispose();
        }
    });
    
    Logger.log('Extension activated');
}

// This method is called when your extension is deactivated
export function deactivate() {
}