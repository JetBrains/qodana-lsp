import * as vscode from 'vscode';
import TelemetryReporter from '@vscode/extension-telemetry';

const TELEMETRY_KEY = '57fd04ec-ed3a-4dbe-af8e-54d0e8b4b2fa';

/* eslint-disable @typescript-eslint/naming-convention */
class TelemetryEvents {
    private readonly telemetryReporter: TelemetryReporter;
    private static _instance: TelemetryEvents;

    private constructor() {
        this.telemetryReporter = new TelemetryReporter(TELEMETRY_KEY);
    }

    public static get instance(): TelemetryEvents {
        if (!this._instance) {
            this._instance = new TelemetryEvents();
        }
        return this._instance;
    }

    static eventNames = {
        EXTENSION_STARTED: 'extensionStarted',
        EXTENSION_REMOVED: 'extensionRemoved',
        OPENED_FROM_CLOUD: 'openedFromCloud',
        REPORT_OPENED: 'reportOpened',
        REPORT_CLOSED: 'reportClosed',
        AUTHENTICATION_RESETTED: 'authenticationResetted',
        SETTINGS_RESETTED: 'settingsResetted',
        ISSUES_TOGGLED: 'issuesToggled',
        BASELINE_TOGGLED: 'baselineToggled',
        JBR_DOWNLOADED: 'jbrDownloaded',
        CLI_DOWNLOADED: 'cliDownloaded',
        LOCAL_RUN_REQUESTED: 'localRunRequested',
        PROJECT_LINKED: 'projectLinked',
        PROJECT_UNLINKED: 'projectUnlinked',
    };

    extensionStarted(context: vscode.ExtensionContext) {
        context.subscriptions.push(this.telemetryReporter);
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.EXTENSION_STARTED);
    }

    extensionRemoved() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.EXTENSION_REMOVED);
    }

    openedFromCloud() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.OPENED_FROM_CLOUD);
    }

    reportOpened() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.REPORT_OPENED);
    }

    reportClosed() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.REPORT_CLOSED);
    }

    authenticationResetted() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.AUTHENTICATION_RESETTED);
    }

    settingsResetted() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.SETTINGS_RESETTED);
    }

    issuesToggled() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.ISSUES_TOGGLED);
    }

    baselineToggled() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.BASELINE_TOGGLED);
    }

    jbrDownloaded() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.JBR_DOWNLOADED);
    }

    cliDownloaded() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.CLI_DOWNLOADED);
    }

    localRunRequested() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.LOCAL_RUN_REQUESTED);
    }

    errorReceived(error: string) {
        this.telemetryReporter.sendTelemetryErrorEvent(error);
    }

    projectLinked() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.PROJECT_LINKED);
    }

    projectUnlinked() {
        this.telemetryReporter.sendTelemetryEvent(TelemetryEvents.eventNames.PROJECT_UNLINKED);
    }
}

export default TelemetryEvents.instance;