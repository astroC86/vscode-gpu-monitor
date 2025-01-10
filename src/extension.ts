import * as vscode from 'vscode';
import { MonitorPanel } from './MonitorPanel';
import { FileWatcher } from './FileWatcher';
import { Logger } from './shared/logger';

export function activate(context: vscode.ExtensionContext) {
    Logger.init();
    Logger.log('Extension activating');
    
    let currentPanel: MonitorPanel | undefined = undefined;
    let fileWatcher: FileWatcher | undefined = undefined;

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
                            Logger.error(message.text, 'Webview');
                        } else {
                            Logger.log(message.text, 'Webview');
                        }
                        break;
                        
                    case 'startMonitoring':
                        Logger.log(`Starting monitoring with paths - GPU: ${message.gpuPath}, Memory: ${message.memoryPath}`);
                        if (fileWatcher) {
                            fileWatcher.dispose();
                        }
                        fileWatcher = new FileWatcher(
                            currentPanel!,
                            message.gpuPath,
                            message.memoryPath
                        );
                        break;
                        
                    case 'stopMonitoring':
                        Logger.log('Stopping monitoring');
                        if (fileWatcher) {
                            fileWatcher.dispose();
                            fileWatcher = undefined;
                        }
                        break;
                        
                    case 'error':
                        Logger.error(message.text, 'Webview');
                        vscode.window.showErrorMessage(message.text);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
        
        currentPanel.panel.onDidDispose(
            () => {
                Logger.log('Panel disposed');
                currentPanel = undefined;
                if (fileWatcher) {
                    fileWatcher.dispose();
                    fileWatcher = undefined;
                }
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