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
 * 按 modelProvider 对模型进行分组
 */
function groupModels(models: ModelQuota[]): import('../models/quota').QuotaGroup[] {
    const groupMap = new Map<string, ModelQuota[]>();

    // 按 modelProvider 分组
    for (const model of models) {
        const provider = model.modelProvider || 'OTHER';
        if (!groupMap.has(provider)) {
            groupMap.set(provider, []);
        }
        groupMap.get(provider)!.push(model);
    }

    // 生成 QuotaGroup
    const groups: import('../models/quota').QuotaGroup[] = [];

    // 提供商显示名称映射
    const providerDisplayNames: Record<string, string> = {
        'MODEL_PROVIDER_ANTHROPIC': 'Claude',
        'MODEL_PROVIDER_GOOGLE': 'Gemini',
        'MODEL_PROVIDER_OPENAI': 'OpenAI',
        'OTHER': 'Other',
    };

    for (const [provider, items] of groupMap.entries()) {
        if (items.length === 0) continue;

        // 按百分比升序排序，找到最低配额的模型
        items.sort((a, b) => a.percentage - b.percentage);
        const lowestModel = items[0];

        const displayName = providerDisplayNames[provider] || provider.replace('MODEL_PROVIDER_', '');

        groups.push({
            id: provider,
            displayName,
            percentage: lowestModel.percentage,
            resetTime: lowestModel.resetTime,
            resetCountdown: lowestModel.resetCountdown,
            items: items.sort((a, b) => a.name.localeCompare(b.name))
        });
    }

    // 固定排序顺序
    const providerOrder: Record<string, number> = {
        'MODEL_PROVIDER_ANTHROPIC': 0,
        'MODEL_PROVIDER_GOOGLE': 1,
        'MODEL_PROVIDER_OPENAI': 2,
        'OTHER': 99,
    };

    // 按固定顺序排列
    return groups.sort((a, b) => {
        const orderA = providerOrder[a.id] ?? 50;
        const orderB = providerOrder[b.id] ?? 50;
        return orderA - orderB;
    });
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

        // 跳过内部模型
        if (info.isInternal) {
            continue;
        }

        const quotaInfo = info.quotaInfo;
        if (quotaInfo) {
            const percentage = Math.round((quotaInfo.remainingFraction || 0) * 100);
            const resetTime = quotaInfo.resetTime || '';

            models.push({
                name,
                displayName: info.displayName || getModelDisplayName(name),
                percentage,
                resetTime,
                resetCountdown: formatCountdown(resetTime),
                modelProvider: info.modelProvider,
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
