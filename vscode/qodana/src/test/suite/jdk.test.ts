import { downloadAndUnpackJbr } from "../../core/jdk/jbrDownloader";
import * as sinon from 'sinon';
import assert = require('assert');
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('JBR Downloader', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    /*it('1: JBR downloader retrieves info about releases', async () => {
        let releases = await getJbrReleases();
        assert.strictEqual(releases.size, 8);
    });*/

    it('2: Release is downloadable', async () => {
        // generate random file name
        const tempDirName = path.join(os.tmpdir(), Math.random().toString(36).substring(7));
        try {
            await fs.promises.mkdir(tempDirName, { recursive: true });
            let javaPath = await downloadAndUnpackJbr(tempDirName);
            assert.strictEqual(javaPath !== undefined, true);
            await fs.promises.access(javaPath!);
            assert.strictEqual(javaPath!.endsWith('java') || javaPath!.endsWith('java.exe'), true);
        } catch (e) {
            assert.fail('Failed to download and unpack the JBR');
        } finally {
            await fs.promises.rm(tempDirName, { recursive: true });
        }
    });
});