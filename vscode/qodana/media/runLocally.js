//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    document.querySelector('.run-locally-button').addEventListener('click', () => {
        vscode.postMessage({ type: 'qodana.runLocally' });
    });

    document.querySelector('.view-history-button').addEventListener('click', () => {
        vscode.postMessage({ type: 'qodana.openLocalReport' });
    });
}());