import * as vscode from "vscode";
import { State } from "vscode-languageclient/node";

export class Events {
  private static _instance: Events;

  private _onReportFile: vscode.EventEmitter<ReportFileEvent> = new vscode.EventEmitter<ReportFileEvent>();
  private _onReportOpened: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  private _onReportClosed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  private _onProjectLinked: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  private _onConfigChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  private _onBaselineChange: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  private _onServerStateChange: vscode.EventEmitter<State> = new vscode.EventEmitter<State>();
  private _onTimer: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  private _onUrlCallback: vscode.EventEmitter<UrlCallbackEvent> = new vscode.EventEmitter<UrlCallbackEvent>();
  private recurringTimer?: NodeJS.Timer;
  
  private constructor() { }

  public static get instance() {
    if (!Events._instance) {
      Events._instance = new Events();
    }
    return Events._instance;
  }

  get onReportOpened(): vscode.Event<void> {
    return this._onReportOpened.event;
  }

  public fireReportOpened() {
    this._onReportOpened.fire();
  }

  get onReportClosed(): vscode.Event<void> {
    return this._onReportClosed.event;
  }

  public fireReportClosed() {
    this._onReportClosed.fire();
  }

  get onProjectLinked(): vscode.Event<void> {
    return this._onProjectLinked.event;
  }

  public fireProjectLinked() {
    this._onProjectLinked.fire();
  }

  get onReportFile(): vscode.Event<ReportFileEvent> {
    return this._onReportFile.event;
  }

  public fireReportFile(reportFile: ReportFileEvent) {
    this._onReportFile.fire(reportFile);
  }

  get onConfigChange(): vscode.Event<void> {
    return this._onConfigChange.event;
  }

  public fireConfigChange() {
    this._onConfigChange.fire();
  }

  get onBaselineChange(): vscode.Event<void> {
    return this._onBaselineChange.event;
  }

  public fireBaselineChange() {
    this._onBaselineChange.fire();
  }

  get onServerStateChange(): vscode.Event<State> {
    return this._onServerStateChange.event;
  }

  public fireServerStateChange(state: State) {
    this._onServerStateChange.fire(state);
  }

  get onUrlCallback(): vscode.Event<UrlCallbackEvent> {
    return this._onUrlCallback.event;
  }

  public fireUrlCallback(urlCallback: UrlCallbackEvent) {
    this._onUrlCallback.fire(urlCallback);
  }

  get onTimer(): vscode.Event<void> {
    return this._onTimer.event;
  }

  public startTimer(interval: number) {
    this.stopTimer();
    this.recurringTimer = setInterval(() => {
      this._onTimer.fire();
    }, interval);
    this._onTimer.fire();
  }

  public stopTimer() {
    if (this.recurringTimer) {
      clearInterval(this.recurringTimer);
    }
  }
}

export interface ReportFileEvent {
  reportFile?: string;
  reportId?: string;
}

export interface UrlCallbackEvent {
  projectId: string;
  reportId: string;
}