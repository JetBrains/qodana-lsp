import * as vscode from "vscode";
import {Uri} from "vscode";


export function buildHtml(webview: vscode.Webview, extensionUri: Uri, scriptName: string, body: string): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', scriptName));

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'reset.css'));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.css'));
    const nonce = getNonce();
    return  `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <!--
                  Use a content security policy to only allow loading styles from our extension directory,
                  and only allow scripts that have a specific nonce.
                  (See the 'webview-sample' extension sample for img-src content security policy examples)
              -->
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
              
              <meta name="viewport" content="width=device-width, initial-scale=1.0">

              <link href="${styleResetUri}" rel="stylesheet">
              <link href="${styleVSCodeUri}" rel="stylesheet">
              <link href="${styleMainUri}" rel="stylesheet">
              <title>Test Webview</title>
            </head>
            <body>
              ${body}
              <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
}

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}