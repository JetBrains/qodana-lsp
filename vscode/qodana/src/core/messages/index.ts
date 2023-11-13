import * as vscode from 'vscode';

// GIT

export const GIT_EXT_NOT_FOUND = vscode.l10n.t('[Qodana] Git extension not found.');
export const GIT_REMOTE_NOT_FOUND = vscode.l10n.t('[Qodana] Git remote not found.');
export const GIT_ORIGIN_NOT_FOUND = vscode.l10n.t('[Qodana] Git origin not found.');

// AUTH

export const AUTH_FAILED = vscode.l10n.t('[Qodana] Authentication to Qodana Cloud failed.');
export const AUTH_NEEDED = vscode.l10n.t('[Qodana] Authorization for Qodana Cloud is required.');
export const PROCEED = vscode.l10n.t('Proceed');
export const CANCEL = vscode.l10n.t('Cancel');
export const FAILED_TO_OBTAIN_TOKEN = vscode.l10n.t('[Qodana] Failed to obtain token. Try "Qodana: Reset authentication" command and re-connect your project.');
export const FAILED_TO_RENEW_TOKEN = vscode.l10n.t('[Qodana] Failed to renew token. Try "Qodana: Reset authentication" command and re-connect your project.');
export const FAILED_TO_AUTHENTICATE = vscode.l10n.t('[Qodana] Authentication to Qodana Cloud failed: ');

// ACTIVITIES

export const NEW_REPORT_AVAILABLE = vscode.l10n.t('[Qodana] There is a new report available. Would you like to open it?');
export const SHOW_PROBLEMS = vscode.l10n.t('Show Problems');
export const YES = vscode.l10n.t('Yes');
export const NO = vscode.l10n.t('No');
export const CLOUD_REPORT_LOADED = vscode.l10n.t('[Qodana] Cloud report has been successfully loaded.');
export const COMPUTING = vscode.l10n.t('[Qodana] Computing prefix...');
export function computedPrefix(prefix: string|undefined) { return vscode.l10n.t('[Qodana] Computed prefix: {0}.', prefix || 'unknown'); }

// CLIENT

export const FAILED_TO_INITIALIZE = vscode.l10n.t('[Qodana] Failed to initialize extension. Please try restarting VS Code or reinstalling extension. If issue persists, please contact us via YouTrack.');
export const JAVA_NOT_FOUND = vscode.l10n.t('[Qodana] Java executable not found in PATH. Please ensure Java is installed and its path is added to system PATH.');

// CONFIG

export const PROJECT_ID_NOT_SET = vscode.l10n.t('[Qodana] Project ID has not been configured in extension settings. Please configure it and try again.');
export const PATH_PREFIX_NOT_SET = vscode.l10n.t('[Qodana] Path prefix is set to non-existing folder. Refer to extension description for guidance on how to set it properly.');
export const USER_LEVEL_SETTINGS = vscode.l10n.t('[Qodana] User-level settings are not supported. Click "Proceed" to reset them, and then use Workspace tab for configurations.');
export const ULS_PROCEED = vscode.l10n.t('Proceed');
export const RELOAD_TO_APPLY = vscode.l10n.t('[Qodana] Please reload to apply changes.');
export const RELOAD = vscode.l10n.t('Reload');

// HANDLER

export function idNotSet(id: string) { return vscode.l10n.t('[Qodana] Project ID has not been configured in extension settings. \n Set it to {0} to show report.', id); }
export function idNotEqual(id: string) { return vscode.l10n.t('[Qodana] Project ID in extension settings does not match project ID in report. \n Set it to {0} to load report.', id); }
export const ID_SET = vscode.l10n.t('Set');
export const ID_CANCEL = vscode.l10n.t('Cancel');
export const FAILED_PATH_NOT_PRESENT = vscode.l10n.t('[Qodana] Failed to open report. path is missing from URI. Please refer to extension description for guidance.');
export const FAILED_ID_NOT_PRESENT = vscode.l10n.t('[Qodana] Failed to open report. Project ID is missing from extension settings. Refer to extension description for guidance on how to set it properly.');
export const FAILED_PREFIX_NOT_SET = vscode.l10n.t('[Qodana] Path prefix is not set in settings. Refer to extension description for guidance on how to set it properly.');

// REPORT

export function failedToObtainData(projectId: string) { return vscode.l10n.t('[Qodana] Unable to retrieve data for project {0}.', projectId); }
export function noReportsFound(projectId: string) { return vscode.l10n.t('[Qodana] No reports available for project {0}.', projectId); }
export function failedToObtainReportId(reportId: string, projectId: string) { return vscode.l10n.t('[Qodana] Unable to retrieve report ID {0} for project {1}.', reportId, projectId); }
export function noFilesFound(reportId: string, projectId: string) { return vscode.l10n.t('[Qodana] No files available for report ID {0} in project {1}.', reportId, projectId); }
export function failedToObtainReport(reportId: string, projectId: string) { return vscode.l10n.t('[Qodana] Unable to retrieve report id {0} for project {1}.', reportId, projectId); }
export function failedToDownloadReport(projectId: string) { return vscode.l10n.t('[Qodana] Unable to download report for specified project {0}.', projectId); }
export function failedToDownloadReportWithId(projectId: string, reportId: string) { return vscode.l10n.t('[Qodana] Unable to download report {0} for specified project {1}.', reportId, projectId); }
export function projectIdIsNotValid(projectId: string) { return vscode.l10n.t('[Qodana] Project ID {0} is not valid.', projectId); }

// JBR

export function failedToDownloadJbr(jbr: string) { return vscode.l10n.t('[Qodana] Unable to download JBR Runtime {0}.', jbr); }
export function failedToExtractJbr(jbr: string) { return vscode.l10n.t('[Qodana] Unable to extract JBR Runtime {0}.', jbr); }
export const DOWNLOAD_CONFIRMATION = vscode.l10n.t('[Qodana] requires Java 11 or higher to run. Do you want to download and use JetBrains Runtime?');
export function successfullyExtracted(jbr: string) { return vscode.l10n.t('[Qodana] Extracted JBR Runtime to {0}.', jbr); }