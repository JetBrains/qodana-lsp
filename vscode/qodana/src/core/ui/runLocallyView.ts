import * as vscode from "vscode";
import {CancellationToken, WebviewView, WebviewViewResolveContext} from "vscode";
import {buildHtml} from "./util";
import {COMMANDS} from "../config";

export class RunLocallyView implements vscode.WebviewViewProvider {
    public static readonly viewType = 'qodana.run-locally-view';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

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
            if (COMMANDS.has(data.type)) {
                vscode.commands.executeCommand(data.type);
            }
        });
    }

    private getHtml(webview: vscode.Webview) {
        return buildHtml(webview, this._extensionUri, 'settings.js', `
              <button class="run-locally-button">Run Locally</button>
              <button class="view-history-button secondary">View History</button>`
        );
    }
}