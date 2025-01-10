// src/MonitorPanel.ts
import * as vscode from 'vscode';
import { getNonce } from './shared/utils';

export class MonitorPanel {
    public static readonly viewType = 'gpuMonitor';
    public readonly panel: vscode.WebviewPanel;

    constructor(
        private readonly extensionUri: vscode.Uri,
    ) {
        this.panel = vscode.window.createWebviewPanel(
            MonitorPanel.viewType,
            'GPU & Memory Monitor',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableFindWidget: true,
                // Enable dev tools
                enableCommandUris: true,
                // Enable debugging
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist')
                ]
            }
        );

        this.panel.webview.html = this._getWebviewContent(this.panel.webview, extensionUri);
    }

    public updateData(message: any) {
        this.panel.webview.postMessage(message);
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
        );

        const nonce = getNonce();

        // Add debugging logs and error handling
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval';">
                <title>GPU & Memory Monitor</title>
                <script nonce="${nonce}">
                    window.onerror = function(message, source, lineno, colno, error) {
                        console.error('Global error:', message, 'Source:', source, 'Line:', lineno, error);
                    };
                    window.addEventListener('unhandledrejection', function(event) {
                        console.error('Unhandled promise rejection:', event.reason);
                    });
                    console.log('Webview starting...');
                </script>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}">
                    console.log('Loading script from:', '${scriptUri}');
                </script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}