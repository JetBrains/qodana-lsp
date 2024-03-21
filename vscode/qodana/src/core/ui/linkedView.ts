import * as vscode from "vscode";
import {CancellationToken, WebviewView, WebviewViewResolveContext} from "vscode";
import {Events} from "../events";
import {extensionInstance} from "../extension";
import {buildHtml} from "./util";
import {linkedToProject} from "../messages";

export class LinkedView implements vscode.WebviewViewProvider {
    public static readonly viewType = 'qodana.linked';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {
        Events.instance.onProjectLinked(() => {
            let view = this._view;
            if (view) {
                view.webview.html = this.getHtml(view?.webview);
            }
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
            switch (data.type) {
                case 'unlink':
                {
                    extensionInstance.linkService?.unlinkProject();
                    break;
                }
                case 'openReport':
                {
                    extensionInstance.linkService?.openReport();
                    break;
                }
            }
        });
    }

    private getHtml(webview: vscode.Webview) {
        return buildHtml(webview, this._extensionUri, 'link.js', `
              <p>${linkedToProject(extensionInstance.linkService?.getLinkedProjectName())}</p>
              <br>
              <button class="unlink-button secondary">Unlink Project</button>
              <button class="open-report-button secondary">Open Report</button>`
        );
    }

}

