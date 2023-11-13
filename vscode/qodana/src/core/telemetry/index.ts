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
        AUTHENTICATION_RESETTED: 'authenticationResetted',
        SETTINGS_RESETTED: 'settingsResetted',
        ISSUES_TOGGLED: 'issuesToggled',
        BASELINE_TOGGLED: 'baselineToggled',
        JBR_DOWNLOADED: 'jbrDownloaded',
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

    errorReceived(error: string) {
        this.telemetryReporter.sendTelemetryErrorEvent(error);
    }
}

export default TelemetryEvents.instance;