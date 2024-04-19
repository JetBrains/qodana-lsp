import * as vscode from "vscode";
import {CancellationToken, WebviewView, WebviewViewResolveContext} from "vscode";
import {Events} from "../events";
import {buildHtml} from "./util";
import {COMMANDS, WS_OPENED_REPORT} from "../config";

export class LogInView implements vscode.WebviewViewProvider {
    public static readonly viewType = 'qodana.login-view';

    private _view?: vscode.WebviewView;

    constructor(private readonly context: vscode.ExtensionContext) {
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
                this.context.extensionUri
            ]
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        let projectId =  this.context.workspaceState.get(WS_OPENED_REPORT);
        let isVisible = projectId !== undefined && projectId !== null;
        this._view?.webview.postMessage({type: 'hide', data: '.close-report-button', visible: isVisible});
        webviewView.webview.onDidReceiveMessage(data => {
            if (COMMANDS.has(data.type)) {
                vscode.commands.executeCommand(data.type);
            }
        });
    }

    private getHtml(webview: vscode.Webview) {
        return buildHtml(webview, this.context.extensionUri, 'login.js', `
              <button class="login-button">Log In to Cloud</button>
              <button class="self-hosted-button secondary">Log In to Self-Hosted</button>
              <button class="close-report-button secondary hide-element">Turn Analysis Off</button>`
        );
    }
}