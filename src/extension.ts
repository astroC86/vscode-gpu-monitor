// src/extension/extension.ts
import * as vscode from 'vscode';
import { MonitorPanel } from './MonitorPanel';
import { Logger } from './shared/logger';

export function activate(context: vscode.ExtensionContext) {
    Logger.init();
    let currentPanel: MonitorPanel | undefined = undefined;

    let disposable = vscode.commands.registerCommand('vscode-gpu-monitor.start', () => {
        if (currentPanel) {
            currentPanel.panel.reveal();
            return;
        }

        currentPanel = new MonitorPanel(context.extensionUri);
        
        currentPanel.panel.onDidDispose(
            () => {
                currentPanel = undefined;
            },
            null,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}