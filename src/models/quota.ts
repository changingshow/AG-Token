/**
 * 配额数据模型
 */

/** 单个模型的配额信息 */
export interface ModelQuota {
    /** 模型名称，如 "gemini-3-pro-high" */
    name: string;
    /** 显示名称，如 "Gemini Pro" */
    displayName: string;
    /** 剩余百分比 0-100 */
    percentage: number;
    /** 重置时间 ISO 字符串 */
    resetTime: string;
    /** 倒计时字符串，如 "4h 30m" */
    resetCountdown: string;
}

/** 配额分组 */
export interface QuotaGroup {
    /** 组 ID (通常是代表模型名) */
    id: string;
    /** 组显示名称 (如 "Claude Series") */
    displayName: string;
    /** 剩余百分比 (组内共享) */
    percentage: number;
    /** 重置时间 */
    resetTime: string;
    /** 倒计时 */
    resetCountdown: string;
    /** 包含的具体模型 */
    items: ModelQuota[];
}

/** 完整配额数据 */
export interface QuotaData {
    /** 原始模型列表 */
    models: ModelQuota[];
    /** 分组后的列表 (用于 UI 显示) */
    groups: QuotaGroup[];
    /** 最后更新时间戳 */
    lastUpdated: number;
    /** 是否 403 禁止访问 */
    isForbidden?: boolean;
    /** 错误信息 */
    error?: string;
}

/** Token 数据 */
export interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiryTimestamp: number;
    email?: string;
    projectId?: string;
}

/** API 响应类型 */
export interface QuotaApiResponse {
    models: {
        [modelName: string]: {
            quotaInfo?: {
                remainingFraction: number;
                resetTime: string;
            };
        };
    };
}

export interface TokenRefreshResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

export interface ProjectIdResponse {
    cloudaicompanionProject?: string;
}

/** 模型显示名称映射 */
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
    'gemini-3-pro-high': 'Gemini 3 Pro',
    'gemini-3-pro-low': 'Gemini 3 Pro Low',
    'gemini-3-pro-image': 'Gemini Drawing',
    'gemini-3-flash': 'Gemini 3 Flash',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'claude-sonnet-4-5': 'Claude Sonnet',
    'claude-sonnet-4-5-thinking': 'Claude Sonnet (Thinking)',
    'claude-opus-4-5-thinking': 'Claude Opus (Thinking)',
    'gpt-oss-120b-medium': 'Mistral/GPT-OSS',
};

/** 获取模型显示名称 */
export function getModelDisplayName(name: string): string {
    // 移除常见后缀以简化显示
    if (MODEL_DISPLAY_NAMES[name]) {
        return MODEL_DISPLAY_NAMES[name];
    }

    // 简单的格式化 fallback
    return name
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}
