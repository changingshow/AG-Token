/**
 * 格式化工具函数
 */

/**
 * 计算倒计时字符串
 * @param resetTime ISO 时间字符串
 * @returns 格式化的倒计时，如 "4h 30m" 或 "2d 12h"
 */
export function formatCountdown(resetTime: string): string {
    try {
        const resetDate = new Date(resetTime);
        const now = new Date();
        const diffMs = resetDate.getTime() - now.getTime();

        if (diffMs <= 0) {
            return '即将重置';
        }

        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            const hours = diffHours % 24;
            return `${diffDays}d ${hours}h`;
        } else if (diffHours > 0) {
            const minutes = diffMinutes % 60;
            return `${diffHours}h ${minutes}m`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes}m`;
        } else {
            return '< 1m';
        }
    } catch {
        return '未知';
    }
}


/**
 * 创建进度条字符串
 * @param percentage 百分比 0-100
 * @param length 进度条长度
 * @returns 进度条字符串
 */
export function createProgressBar(percentage: number, length: number = 10): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * 获取状态颜色类名
 * @param percentage 百分比
 * @param warningThreshold 警告阈值
 * @param criticalThreshold 紧急阈值
 * @returns 状态类名
 */
export function getStatusClass(
    percentage: number,
    warningThreshold: number = 30,
    criticalThreshold: number = 10
): 'success' | 'warning' | 'critical' | 'empty' {
    if (percentage <= 0) {
        return 'empty';
    } else if (percentage < criticalThreshold) {
        return 'critical';
    } else if (percentage < warningThreshold) {
        return 'warning';
    }
    return 'success';
}

/**
 * 获取状态图标
 * @param percentage 百分比
 * @param warningThreshold 警告阈值
 * @param criticalThreshold 紧急阈值
 * @returns 状态图标
 */
export function getStatusIcon(
    percentage: number,
    warningThreshold: number = 30,
    criticalThreshold: number = 10
): string {
    const status = getStatusClass(percentage, warningThreshold, criticalThreshold);
    switch (status) {
        case 'success':
            return '🟢';
        case 'warning':
            return '🟡';
        case 'critical':
            return '🔴';
        case 'empty':
            return '⚫';
    }
}

/**
 * 休眠函数
 * @param ms 毫秒数
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
