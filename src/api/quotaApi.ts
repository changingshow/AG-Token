/**
 * 配额查询 API
 */

import type { QuotaData, QuotaApiResponse, ProjectIdResponse, ModelQuota } from '../models/quota';
import { getModelDisplayName } from '../models/quota';
import { formatCountdown, sleep } from '../utils/format';

// API 配置
const QUOTA_API_URL = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels';
const PROJECT_API_URL = 'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist';
const USER_AGENT = 'antigravity/1.11.3 Darwin/arm64';

/**
 * 获取 Project ID
 */
export async function fetchProjectId(accessToken: string): Promise<string | undefined> {
    const requestBody = { metadata: { ideType: 'ANTIGRAVITY' } };

    try {
        const response = await fetch(PROJECT_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            return undefined;
        }

        const data = await response.json() as ProjectIdResponse;
        return data.cloudaicompanionProject;
    } catch {
        return undefined;
    }
}

/**
 * 对模型进行分组
 */
function groupModels(models: ModelQuota[]): import('../models/quota').QuotaGroup[] {
    const groups: import('../models/quota').QuotaGroup[] = [];

    // 按 percentage + resetTime 作为唯一键进行分组
    const groupMap = new Map<string, ModelQuota[]>();

    for (const model of models) {
        const isImportant = /gemini|claude|gpt|chat/i.test(model.name);
        if (model.percentage === 100 && !isImportant) {
            continue;
        }

        const key = `${model.percentage}-${model.resetTime}`;
        if (!groupMap.has(key)) {
            groupMap.set(key, []);
        }
        groupMap.get(key)!.push(model);
    }

    // 生成 QuotaGroup
    for (const [key, items] of groupMap.entries()) {
        if (items.length === 0) continue;

        let displayName = '';

        const hasClaude = items.some(i => i.name.includes('claude'));
        const hasGemini = items.some(i => i.name.includes('gemini'));
        const hasImage = items.some(i => i.name.includes('image'));

        if (hasClaude) {
            displayName = 'Claude';
        } else if (hasImage) {
            displayName = 'Gemini Drawing';
        } else if (hasGemini) {
            const firstGemini = items.find(i => i.name.includes('gemini'));
            if (firstGemini) {
                displayName = getModelDisplayName(firstGemini.name).replace(/ (High|Low|Lite|Thinking)/g, '');
            } else {
                displayName = 'Gemini Family';
            }
        } else {
            displayName = getModelDisplayName(items[0].name);
        }

        if (groups.some(g => g.displayName === displayName)) {
            displayName += ` (${items.length})`;
        }

        groups.push({
            id: key,
            displayName,
            percentage: items[0].percentage,
            resetTime: items[0].resetTime,
            resetCountdown: items[0].resetCountdown,
            items: items.sort((a, b) => a.name.localeCompare(b.name))
        });
    }

    return groups.sort((a, b) => a.percentage - b.percentage);
}

/**
 * 解析配额响应
 */
function parseQuotaResponse(data: QuotaApiResponse, trackedModels?: string[]): QuotaData {
    const models: ModelQuota[] = [];

    for (const [name, info] of Object.entries(data.models)) {
        if (trackedModels && !trackedModels.includes(name)) {
            continue;
        }

        const quotaInfo = info.quotaInfo;
        if (quotaInfo) {
            const percentage = Math.round((quotaInfo.remainingFraction || 0) * 100);
            const resetTime = quotaInfo.resetTime || '';

            models.push({
                name,
                displayName: getModelDisplayName(name),
                percentage,
                resetTime,
                resetCountdown: formatCountdown(resetTime),
            });
        }
    }

    models.sort((a, b) => a.percentage - b.percentage);

    return {
        models,
        groups: groupModels(models),
        lastUpdated: Date.now(),
    };
}

/**
 * 查询配额
 */
export async function fetchQuota(
    accessToken: string,
    projectId?: string,
    trackedModels?: string[]
): Promise<QuotaData> {
    try {
        if (!projectId) {
            projectId = await fetchProjectId(accessToken);
        }

        const requestBody: Record<string, string> = {};
        if (projectId) requestBody.project = projectId;

        const response = await fetch(QUOTA_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (response.status === 403) {
            return {
                models: [],
                groups: [],
                lastUpdated: Date.now(),
                isForbidden: true,
                error: '账号无权限',
            };
        }

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json() as QuotaApiResponse;
        return parseQuotaResponse(data, trackedModels);

    } catch (error) {
        return {
            models: [],
            groups: [],
            lastUpdated: Date.now(),
            error: error instanceof Error ? error.message : '未知错误',
        };
    }
}

/**
 * 带重试的配额查询
 */
export async function fetchQuotaWithRetry(
    accessToken: string,
    projectId?: string,
    trackedModels?: string[],
    maxRetries: number = 3
): Promise<QuotaData> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fetchQuota(accessToken, projectId, trackedModels);

            if (result.error && !result.isForbidden && attempt < maxRetries) {
                await sleep(1000);
                continue;
            }

            return result;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) {
                await sleep(1000);
            }
        }
    }

    return {
        models: [],
        groups: [],
        lastUpdated: Date.now(),
        error: lastError?.message || '配额查询失败',
    };
}
