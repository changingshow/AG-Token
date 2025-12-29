/**
 * OAuth 认证 API
 */

import type { TokenData, TokenRefreshResponse } from '../models/quota';

// Google OAuth 配置
const CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * 刷新 Access Token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
    const requestBody = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    };

    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(requestBody),
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json() as TokenRefreshResponse;
        const now = Math.floor(Date.now() / 1000);

        return {
            accessToken: data.access_token,
            refreshToken: refreshToken,
            expiryTimestamp: now + data.expires_in,
        };
    } catch {
        return null;
    }
}

/**
 * 获取用户信息
 */
export async function getUserInfo(accessToken: string): Promise<{ email: string; name?: string } | null> {
    try {
        const response = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json() as { email: string; name?: string; given_name?: string };
        return {
            email: data.email,
            name: data.name || data.given_name,
        };
    } catch {
        return null;
    }
}

/**
 * 检查 Token 是否需要刷新
 */
export function needsRefresh(expiryTimestamp: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return expiryTimestamp <= now + 300;
}

/**
 * 确保 Token 有效
 */
export async function ensureFreshToken(token: TokenData): Promise<TokenData | null> {
    if (!needsRefresh(token.expiryTimestamp)) {
        return token;
    }
    return await refreshAccessToken(token.refreshToken);
}
