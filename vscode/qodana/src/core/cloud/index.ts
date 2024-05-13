import {cloudWebsite} from "../defaults";
import {qodanaCloudUnauthorizedApi} from "./api";


export class CloudEnvironment {
    private lastBackendUrlsRequest: Promise<BackendUrls | undefined> | undefined = undefined;
    public frontendUrl: string;

    constructor(frontendUrl?: string) {
        this.frontendUrl = frontendUrl ? frontendUrl : cloudWebsite();
    }

    async getBackendUrlForVersion(version: String) {
        if (this.lastBackendUrlsRequest === undefined) {
            this.lastBackendUrlsRequest = new Promise (async (resolve, reject) => {
                try {
                    let urls = await qodanaCloudUnauthorizedApi(this).getBackendUrls(this.frontendUrl);
                    if (urls !== undefined) {
                        resolve(urls);
                        return;
                    }
                    this.lastBackendUrlsRequest = undefined;
                    reject();
                } catch (error) {
                    reject(error);
                }
            });
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

