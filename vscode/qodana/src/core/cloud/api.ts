import {BackendUrls, CloudEnvironment} from "./index";
import {QodanaCloudUnauthorizedApiImpl} from "./unauthorized";


export interface QodanaCloudUnauthorizedApi {
    getOauthToken(code: string | undefined): Promise<AuthorizationResponseData | undefined>

    refreshOauthToken(refreshCode: string | undefined): Promise<AuthorizationResponseData | undefined>

    getOauthProviderData(): Promise<QodanaOauthProviderData | undefined>

    getBackendUrls(frontendUrl: string): Promise<BackendUrls | undefined>
}

export interface QodanaCloudUserApi {
    getProjectsByOriginUrl(originUrl: string): Promise<CloudProjectsByOriginUrlResponse | undefined>

    getProjectProperties(projectId: string): Promise<CloudProjectResponse | undefined>

    getReport(reportId: string, projectId: string): Promise<Files<QodanaCloudFileResponse> | undefined>

    getReportId(projectId: string): Promise<string | undefined>

    getUserInfo(): Promise<QodanaCloudUserInfoResponse | undefined>
}

export function qodanaCloudUnauthorizedApi(environment: CloudEnvironment) {
    return new QodanaCloudUnauthorizedApiImpl(environment);
}


export interface AuthorizationResponseData {
    access: string,
    refresh: string,
    expires_at: string
}

export interface CloudProjectsByOriginUrlResponse {
    matchingProjects: MatchingProject[]
}

export interface MatchingProject {
    projectId: string,
    projectName: string,
    organizationName: string,
    teamName: string,
    reportInfo: ReportInfo
}

export interface ReportInfo {
    problems: Problems,
    branch: string,
    lastChecked: string,
    baselineCount: number,
    url: string
}

export interface Problems {
    total: number
}

export interface CloudProjectResponse {
    id: string,
    organizationId: string,
    name?: string
}

export interface QodanaOauthProviderData {
    oauthUrl: string;
    providerName: string;
}


export interface PaginatedResponse<T> {
    items: T[];
    next: number | null;
}

export interface QodanaCloudReportResponse {
    reportId: string;
}

export interface Files<T> {
    files: T[];
}

export interface QodanaCloudFileResponse {
    file: string;
    url: string;
}

export interface QodanaCloudUserInfoResponse {
    id: string;
    fullName?: string;
    username?: string;
}