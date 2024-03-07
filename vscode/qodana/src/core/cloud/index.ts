import {cloudWebsite} from "../defaults";
import * as vscode from "vscode";
import {qodanaCloudUnauthorizedApi} from "./api";


export class CloudEnvironment {
    private readonly frontendUrl: string;
    private lastBackendUrlsRequest: Promise<BackendUrls | undefined> | undefined = undefined;

    constructor(frontendUrl?: string) {
        this.frontendUrl = frontendUrl ? frontendUrl : cloudWebsite();
    }

    async getBackendUrlForVersion(version: String) {
        let newTask: Promise<BackendUrls | undefined> = new Promise (async (resolve, reject) => {
            let urls = await qodanaCloudUnauthorizedApi(this).getBackendUrls(this.frontendUrl);
            if (urls !== undefined) {
                resolve(urls);
                return;
            }
            this.lastBackendUrlsRequest = undefined;
            reject();
        });
        if (this.lastBackendUrlsRequest === undefined) {
            this.lastBackendUrlsRequest = newTask;
        }
        let urls = await this.lastBackendUrlsRequest;
        return urls?.api?.versions?.find(
            versionUrl=> versionUrl.version.split(".")[0] === version
        )?.url;
    }

}

export interface BackendUrls {
    api: VersionHolder;
    linters: VersionHolder;
}

interface VersionHolder {
    versions: VersionUrl[];
}

interface VersionUrl {
    version: string;
    url: string
}

