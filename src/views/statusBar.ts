/**
 * 状态栏管理器
 * 在 VSCode 状态栏显示配额信息
 */

import * as vscode from 'vscode';
import type { QuotaData, QuotaGroup } from '../models/quota';
import { getStatusIcon, createProgressBar } from '../utils/format';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'agToken.showPanel';
        this.statusBarItem.name = 'AG Token';
        this.statusBarItem.show();

        // 初始状态
        this.statusBarItem.text = '$(sync~spin) AG';
        this.statusBarItem.tooltip = '正在加载配额数据...';
    }

    /**
     * 更新状态栏显示
     */
    update(quotaData: QuotaData): void {
        const config = vscode.workspace.getConfiguration('agToken');
        const warningThreshold = config.get<number>('warningThreshold', 30);
        const criticalThreshold = config.get<number>('criticalThreshold', 10);

        // 处理错误状态
        if (quotaData.error) {
            this.statusBarItem.text = '$(error) AG';
            this.statusBarItem.tooltip = this.buildErrorTooltip(quotaData.error);
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            return;
        }

        // 处理 403 禁止访问
        if (quotaData.isForbidden) {
            this.statusBarItem.text = '$(lock) AG';
            this.statusBarItem.tooltip = this.buildErrorTooltip('账号无权限访问配额 API');
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            return;
        }

        // 处理无数据
        if (!quotaData.groups || quotaData.groups.length === 0) {
            this.statusBarItem.text = '$(dash) AG';
            this.statusBarItem.tooltip = '暂无配额数据，点击查看详情';
            this.statusBarItem.backgroundColor = undefined;
            return;
        }

        // 找到最低配额的组
        const lowestGroup = this.findLowestGroup(quotaData.groups);
        if (!lowestGroup) {
            return;
        }

        // 设置图标
        const icon = this.getStatusEmoji(lowestGroup.percentage, warningThreshold, criticalThreshold);

        // 显示: 图标 + 组名 + 百分比
        // 例如: 🟡 Claude: 24%
        this.statusBarItem.text = `${icon} ${lowestGroup.displayName}: ${lowestGroup.percentage}%`;

        // 设置 Tooltip
        this.statusBarItem.tooltip = this.buildTooltip(quotaData.groups, warningThreshold, criticalThreshold);

        // 设置背景色
        if (lowestGroup.percentage < criticalThreshold) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else if (lowestGroup.percentage < warningThreshold) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    /**
     * 设置加载状态
     */
    setLoading(): void {
        this.statusBarItem.text = '$(sync~spin) 加载中...';
        this.statusBarItem.tooltip = '正在刷新配额...';
        this.statusBarItem.backgroundColor = undefined;
    }

    /**
     * 获取状态 Emoji
     */
    private getStatusEmoji(percentage: number, warning: number, critical: number): string {
        if (percentage < critical) return '🔴';
        if (percentage < warning) return '🟡';
        return '🟢';
    }

    /**
     * 找到最低配额的组
     */
    private findLowestGroup(groups: QuotaGroup[]): QuotaGroup | undefined {
        if (!groups || groups.length === 0) return undefined;
        return groups.reduce((lowest, current) =>
            (!lowest || current.percentage < lowest.percentage) ? current : lowest
            , undefined as QuotaGroup | undefined);
    }

    /**
     * 构建错误 Tooltip
     */
    private buildErrorTooltip(errorMessage: string): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        md.appendMarkdown(`## ⚠️ AG Token\n\n`);
        md.appendMarkdown(`**错误:** ${errorMessage}\n\n`);
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(`*点击重试*`);

        return md;
    }

    /**
     * 构建 Tooltip - 优化版
     */
    private buildTooltip(
        groups: QuotaGroup[],
        warningThreshold: number,
        criticalThreshold: number
    ): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        // 标题
        md.appendMarkdown(`## 🚀 AG Token\n\n`);

        // 配额列表 - 使用表格形式更清晰
        md.appendMarkdown(`| 模型组 | 配额 | 重置时间 |\n`);
        md.appendMarkdown(`|:-------|-----:|:--------|\n`);

        for (const group of groups) {
            const emoji = this.getStatusEmoji(group.percentage, warningThreshold, criticalThreshold);
            const pct = `${group.percentage}%`;
            const reset = group.resetCountdown || '-';

            md.appendMarkdown(`| ${emoji} ${group.displayName} | **${pct}** | ${reset} |\n`);
        }



        return md;
    }

    /**
     * 销毁
     */
    dispose(): void {
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
