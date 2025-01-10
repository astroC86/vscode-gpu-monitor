import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    
    static init() {
        this.outputChannel = vscode.window.createOutputChannel('GPU Monitor');
    }

    static log(message: string, context: string = 'Extension') {
        const timestamp = new Date().toISOString();
        this.outputChannel?.appendLine(`[${timestamp}] [${context}] ${message}`);
    }

    static error(error: Error | string, context: string = 'Extension') {
        const timestamp = new Date().toISOString();
        const message = error instanceof Error ? `${error.message}\n${error.stack}` : error;
        this.outputChannel?.appendLine(`[${timestamp}] [${context}] ERROR: ${message}`);
    }

    static show() {
        this.outputChannel?.show();
    }

    static dispose() {
        this.outputChannel?.dispose();
    }
}

// Logs coming from webview will be sent to extension via postMessage
export const webviewLogger = {
    log: (message: string) => {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({
            command: 'log',
            text: message,
            level: 'info'
        });
    },
    error: (error: Error | string) => {
        const vscode = acquireVsCodeApi();
        const message = error instanceof Error ? `${error.message}\n${error.stack}` : error;
        vscode.postMessage({
            command: 'log',
            text: message,
            level: 'error'
        });
    }
};