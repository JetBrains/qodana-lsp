import * as vscode from 'vscode';
import {CancellationToken, WebviewView, WebviewViewResolveContext} from 'vscode';
import {Events} from '../events';
import {buildHtml} from './util';
import {extensionInstance} from '../extension';
import {COMMANDS, WS_OPENED_REPORT} from '../config';
import {loggedInAs} from '../messages';
import { State } from 'vscode-languageclient/node';

export class SettingsView implements vscode.WebviewViewProvider {
    public static readonly viewType = 'qodana.settings';

    private _view?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) {
        Events.instance.onReportOpened(() => {
            this._view?.webview.postMessage({type: 'hide', data: '.close-report-button', visible: true});
            this._view?.webview.postMessage({type: 'hide', data: '.toggle-analysis-button', visible: true});
        });
        Events.instance.onReportClosed(() => {
            this._view?.webview.postMessage({type: 'hide', data: '.close-report-button', visible: false});
            let isLinked = extensionInstance.linkService?.getLinkedProjectId() !== undefined;
            this._view?.webview.postMessage({type: 'hide', data: '.toggle-analysis-button', visible: isLinked});
        });
        Events.instance.onServerStateChange((state) => {
            this.updateServerState(state);
        });
    }

    private updateServerState(state: State) {
        let isRunning = state === State.Running;
        this._view?.webview.postMessage({
            type: 'update-state',
            data: {
                selector: '.toggle-analysis-button',
                text: isRunning ? 'Turn Analysis Off' : 'Turn Analysis On'
            }
        });
    }

    resolveWebviewView(webviewView: WebviewView, _context: WebviewViewResolveContext, _token: CancellationToken): Thenable<void> | void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri
            ]
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(data => {
            if (COMMANDS.has(data.type)) {
                vscode.commands.executeCommand(data.type);
            }
        });
        let projectId =  this.context.workspaceState.get(WS_OPENED_REPORT);
        let isVisible = projectId !== undefined && projectId !== null;
        this._view?.webview.postMessage({type: 'hide', data: '.close-report-button', visible: isVisible});
        
        let isLinked = extensionInstance.linkService?.getLinkedProjectId() !== undefined;
        this._view?.webview.postMessage({type: 'hide', data: '.toggle-analysis-button', visible: isLinked || isVisible});

        if (extensionInstance.languageClient) {
            this.updateServerState(extensionInstance.languageClient.state);
        }
    }

    private getHtml(webview: vscode.Webview) {
        let username = extensionInstance.auth?.getAuthorized()?.userInfo?.fullName;
        if (!username) {
            username = extensionInstance.auth?.getAuthorized()?.userInfo?.username;
        }
        let isRunning = extensionInstance.languageClient?.state === State.Running;
        let toggleText = isRunning ? 'Turn Analysis Off' : 'Turn Analysis On';

        let isLinked = extensionInstance.linkService?.getLinkedProjectId() !== undefined;
        let hideClass = (isLinked) ? '' : 'hide-element';

        return buildHtml(webview, this.context.extensionUri, 'settings.js', `
              <p>${loggedInAs(username)}</p>
              <br>
              
              <button class='toggle-analysis-button secondary ${hideClass}'>${toggleText}</button>
              <button class='close-report-button secondary hide-element'>Close Report</button>
              <button class='logout-button secondary'>Log Out</button>`
        );
    }
}