/**
 * AG Token Extension
 * 主入口文件
 */

import * as vscode from 'vscode';
import { StatusBarManager } from './views/statusBar';
import { QuotaPanel } from './views/webviewPanel';
import { fetchQuotaWithRetry } from './api/quotaApi';
import { getToken, isDatabaseExists, clearTokenCache } from './auth/tokenProvider';
import { setExtensionPath } from './utils/sqliteParser';
import type { QuotaData } from './models/quota';

// 全局状态
let statusBar: StatusBarManager;
let quotaData: QuotaData | undefined;
let isRefreshing = false;
let autoRefreshTimer: NodeJS.Timeout | undefined;

/**
 * 扩展激活入口
 */
export function activate(context: vscode.ExtensionContext) {

    // 设置扩展路径，用于 sql.js 定位 WASM 文件
    setExtensionPath(context.extensionPath);

    // 检查 Antigravity 是否安装
    if (!isDatabaseExists()) {
        vscode.window.showWarningMessage(
            'AG Token: 未检测到 Antigravity IDE，请确保已安装并登录。'
        );
    }

    // 初始化状态栏
    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);

    // 注册命令: 显示面板
    context.subscriptions.push(
        vscode.commands.registerCommand('agToken.showPanel', async () => {
            if (!quotaData) {
                await refreshQuota();
            }

            if (quotaData) {
                QuotaPanel.createOrShow(context.extensionUri, quotaData, refreshQuota);
            } else {
                vscode.window.showErrorMessage('无法获取配额数据，请检查 Antigravity 是否已登录。');
            }
        })
    );

    // 注册命令: 刷新配额
    context.subscriptions.push(
        vscode.commands.registerCommand('agToken.refresh', async () => {
            await refreshQuota();
            vscode.window.showInformationMessage('Antigravity 配额已刷新');
        })
    );

    // 监听配置变更
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('agToken.autoRefresh') ||
                event.affectsConfiguration('agToken.refreshInterval')) {
                setupAutoRefresh();
            }
            // 主题切换时刷新状态栏
            if (event.affectsConfiguration('agToken.theme')) {
                if (quotaData) {
                    statusBar?.update(quotaData);
                }
            }
        })
    );

    // 初始加载
    refreshQuota();
    setupAutoRefresh();
}

/**
 * 设置自动刷新
 */
function setupAutoRefresh(): void {
    // 先清除现有定时器
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = undefined;
    }

    const config = vscode.workspace.getConfiguration('agToken');
    const autoRefresh = config.get<boolean>('autoRefresh', false);
    const intervalMinutes = config.get<number>('refreshInterval', 5);

    if (autoRefresh) {
        // 转换为毫秒 (分钟 -> 毫秒)
        // 最小间隔限制为 1 分钟
        const intervalMs = Math.max(intervalMinutes, 1) * 60 * 1000;

        autoRefreshTimer = setInterval(() => {
            refreshQuota();
        }, intervalMs);
    } else {
    }
}

/**
 * 刷新配额数据
 */
async function refreshQuota(): Promise<void> {
    if (isRefreshing) {
        return;
    }

    isRefreshing = true;
    statusBar.setLoading();

    if (QuotaPanel.currentPanel) {
        QuotaPanel.currentPanel.setLoading(true);
    }

    try {
        // 获取 Token
        const token = await getToken();

        if (!token) {
            quotaData = {
                models: [],
                groups: [],
                lastUpdated: Date.now(),
                error: '未找到 Antigravity 登录信息，请确保已登录 Antigravity IDE',
            };
            statusBar.update(quotaData);

            if (QuotaPanel.currentPanel) {
                QuotaPanel.currentPanel.update(quotaData);
            }
            return;
        }

        // 查询配额 (显示所有模型，不过滤)
        quotaData = await fetchQuotaWithRetry(
            token.accessToken,
            token.projectId,
            undefined // 不过滤，显示所有模型
        );

        // 更新 UI
        statusBar.update(quotaData);

        if (QuotaPanel.currentPanel) {
            QuotaPanel.currentPanel.update(quotaData);
        }

        // 检查低配额通知
        checkLowQuotaNotification(quotaData);

    } catch (error) {
        quotaData = {
            models: [],
            groups: [],
            lastUpdated: Date.now(),
            error: error instanceof Error ? error.message : '未知错误',
        };

        statusBar.update(quotaData);

        if (QuotaPanel.currentPanel) {
            QuotaPanel.currentPanel.update(quotaData);
        }
    } finally {
        isRefreshing = false;
    }
}

/**
 * 检查低配额通知
 */
function checkLowQuotaNotification(data: QuotaData): void {
    const config = vscode.workspace.getConfiguration('agToken');
    const enableNotifications = config.get<boolean>('enableNotifications', true);

    if (!enableNotifications || data.error || data.isForbidden) {
        return;
    }

    const warningThreshold = config.get<number>('warningThreshold', 30);

    // 使用配额组进行通知，避免重复
    for (const group of data.groups || []) {
        if (group.percentage < warningThreshold && group.percentage > 0) {
            vscode.window.showWarningMessage(
                `⚠️ ${group.displayName} 配额不足: ${group.percentage}%，将在 ${group.resetCountdown} 后重置`
            );
            // 只通知一次最低的
            break;
        }
    }
}

/**
 * 扩展停用
 */
export function deactivate(): void {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = undefined;
    }
    clearTokenCache();
}
