//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    document.querySelector('.login-button').addEventListener('click', () => {
        vscode.postMessage({ type: 'qodana.login' });
    });

    document.querySelector('.self-hosted-button').addEventListener('click', () => {
        vscode.postMessage({ type: 'qodana.loginCustomServer' });
    });

    document.querySelector('.close-report-button').addEventListener('click', () => {
        vscode.postMessage({ type: 'qodana.closeReport' });
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