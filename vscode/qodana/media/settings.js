//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    document.querySelector('.logout-button').addEventListener('click', () => {
        vscode.postMessage({ type: myConstants.COMMAND_LOG_OUT });
    });

    // noinspection DuplicatedCode
    document.querySelector('.close-report-button').addEventListener('click', () => {
        vscode.postMessage({ type: myConstants.COMMAND_CLOSE_REPORT });
    });

    window.addEventListener('message', event => {
        const message = event.data; // Here 'data' contains information sent from extension.
        switch (message.type) {
            case 'hide':
                let element = document.querySelector(message.data);
                if (element && message.visible === false) {
                    element.classList.add('hide-element');
                } else if (element) {
                    element.classList.remove('hide-element');
                }
                break;
        }
    });
}());