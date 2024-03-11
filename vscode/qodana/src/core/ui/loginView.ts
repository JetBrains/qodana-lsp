import * as vscode from "vscode";
import {CancellationToken, WebviewView, WebviewViewResolveContext} from "vscode";
import {Events} from "../events";
import {buildHtml} from "./util";

export class LogInView implements vscode.WebviewViewProvider {
    public static readonly viewType = 'qodana.login-view';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {
        Events.instance.onReportOpened(() => {
            this._view?.webview.postMessage({type: 'hide', data: '.close-report-button', visible: true});
        });
        Events.instance.onReportClosed(() => {
            this._view?.webview.postMessage({type: 'hide', data: '.close-report-button', visible: false});
        });
    }

    resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext, token: CancellationToken): Thenable<void> | void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(data => {
            console.log(data);
            switch (data.type) {
                case 'login':
                {
                    vscode.commands.executeCommand('qodana.login');
                    break;
                }
                case 'loginCustomServer':
                {
                    vscode.commands.executeCommand('qodana.loginCustomServer');
                    break;
                }
                case 'runLocally':
                {
                    vscode.commands.executeCommand('qodana.runLocally');
                    break;
                }
                case 'openLocalReport':
                {
                    vscode.commands.executeCommand('qodana.openLocalReport');
                    break;
                }
                case 'closeReport':
                {
                    vscode.commands.executeCommand('qodana.closeReport');
                    break;
                }
            }
        });
        this._view?.webview.postMessage({type: 'hide', data: '.close-report-button', visible: false});

    }

    private getHtml(webview: vscode.Webview) {
        return buildHtml(webview, this._extensionUri, 'login.js', `
              <button class="login-button">Log In</button>
              <button class="self-hosted-button">Qodana Self-Hosted</button>
              <button class="run-locally-button">Run Locally</button>
              <button class="open-local-report-button">Open Local Report</button>
              <button class="close-report-button">Close Report</button>`
        );
    }
}