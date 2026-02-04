import * as crypto from 'crypto';

export function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(codeVerifier: string): string {
    return crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
}
