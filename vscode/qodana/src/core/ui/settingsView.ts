import * as vscode from "vscode";
import {CancellationToken, WebviewView, WebviewViewResolveContext} from "vscode";
import {Events} from "../events";
import {buildHtml} from "./util";
import {extensionInstance} from "../extension";
import {COMMANDS} from "../config";
import {loggedInAs} from "../messages";

export class SettingsView implements vscode.WebviewViewProvider {
    public static readonly viewType = 'qodana.settings';

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
            if (COMMANDS.has(data.type)) {
                vscode.commands.executeCommand(data.type);
            }
        });
    }

    private getHtml(webview: vscode.Webview) {
        let username = extensionInstance.auth?.getAuthorized()?.userInfo?.fullName;
        if (!username) {
            username = extensionInstance.auth?.getAuthorized()?.userInfo?.username;
        }
        return buildHtml(webview, this._extensionUri, 'settings.js', `
              <p>${loggedInAs(username)}</p>
              <br>
              <button class="logout-button">Log Out</button>
              <button class="run-locally-button">Run Locally</button>
              <button class="open-local-report-button">Open Local Report</button>
              <button class="close-report-button hide-element">Close Report</button>`
        );
    }
}