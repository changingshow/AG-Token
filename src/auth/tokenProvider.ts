/**
 * Token 提供者
 * 负责从 Antigravity IDE 本地数据库读取认证信息
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { TokenData } from '../models/quota';
import {
    extractRefreshTokenFromProtobuf,
    extractAccessTokenFromProtobuf,
    extractExpiryFromProtobuf,
} from '../utils/protobuf';
import { readValueFromDatabase } from '../utils/sqliteParser';

/**
 * 获取 Antigravity 数据库路径
 */
export function getAntigravityDbPath(): string {
    const platform = process.platform;
    const home = os.homedir();

    switch (platform) {
        case 'darwin':
            return path.join(home, 'Library/Application Support/Antigravity/User/globalStorage/state.vscdb');
        case 'win32':
            const appdata = process.env.APPDATA;
            if (!appdata) {
                throw new Error('无法获取 APPDATA 环境变量');
            }
            return path.join(appdata, 'Antigravity/User/globalStorage/state.vscdb');
        case 'linux':
            return path.join(home, '.config/Antigravity/User/globalStorage/state.vscdb');
        default:
            throw new Error(`不支持的平台: ${platform}`);
    }
}

/**
 * 检查数据库文件是否存在
 */
export function isDatabaseExists(): boolean {
    try {
        const dbPath = getAntigravityDbPath();
        return fs.existsSync(dbPath);
    } catch {
        return false;
    }
}

/**
 * 从 Antigravity 数据库提取 Token
 */
export async function extractTokenFromDatabase(): Promise<TokenData | null> {
    try {
        const dbPath = getAntigravityDbPath();

        if (!fs.existsSync(dbPath)) {
            console.error('[Token] 数据库不存在');
            return null;
        }

        // 读取数据库
        const stateKey = 'jetskiStateSync.agentManagerInitState';
        const base64Data = await readValueFromDatabase(dbPath, stateKey);

        if (!base64Data) {
            console.error('[Token] 未找到登录数据');
            return null;
        }

        // 提取 Token
        const refreshToken = extractRefreshTokenFromProtobuf(base64Data);
        if (!refreshToken) {
            console.error('[Token] 无法提取 Refresh Token');
            return null;
        }

        const accessToken = extractAccessTokenFromProtobuf(base64Data);
        const expiryTimestamp = extractExpiryFromProtobuf(base64Data);

        return {
            accessToken: accessToken || '',
            refreshToken,
            expiryTimestamp: expiryTimestamp || 0,
        };

    } catch (error) {
        console.error('[Token] 提取失败:', error);
        return null;
    }
}

/**
 * 缓存的 Token 数据
 */
let cachedToken: TokenData | null = null;

/**
 * 获取有效的 Token（带缓存）
 */
export async function getToken(forceRefresh: boolean = false): Promise<TokenData | null> {
    // 使用缓存
    if (!forceRefresh && cachedToken) {
        const now = Math.floor(Date.now() / 1000);
        if (cachedToken.expiryTimestamp > now + 300) {
            return cachedToken;
        }
    }

    // 从数据库提取
    const tokenFromDb = await extractTokenFromDatabase();
    if (!tokenFromDb) {
        return null;
    }

    // 刷新 Access Token
    const { refreshAccessToken } = await import('../api/authApi');
    const refreshedToken = await refreshAccessToken(tokenFromDb.refreshToken);

    if (refreshedToken) {
        cachedToken = refreshedToken;
        return cachedToken;
    }

    return null;
}

/**
 * 清除 Token 缓存
 */
export function clearTokenCache(): void {
    cachedToken = null;
}
