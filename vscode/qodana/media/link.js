//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    document.querySelector('.unlink-button').addEventListener('click', () => {
        vscode.postMessage({ type: 'unlink' });
    });

    document.querySelector('.open-report-button').addEventListener('click', () => {
        vscode.postMessage({ type: 'openReport' });
    });
}());