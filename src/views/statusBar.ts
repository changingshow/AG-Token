/**
 * 状态栏管理器
 * 在 VSCode 状态栏显示配额信息
 */

import * as vscode from 'vscode';
import type { QuotaData, QuotaGroup } from '../models/quota';

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

        // 构建状态栏文本：显示所有分组的最低配额
        const parts: string[] = [];
        for (const group of quotaData.groups) {
            const emoji = this.getStatusEmoji(group.percentage, warningThreshold, criticalThreshold);
            parts.push(`${emoji}${group.displayName} ${group.percentage}%`);
        }
        this.statusBarItem.text = parts.join(' | ');

        // 设置 Tooltip - 只显示分组信息
        this.statusBarItem.tooltip = this.buildTooltip(quotaData.groups, warningThreshold, criticalThreshold);

        // 找到最低配额的组来设置背景色
        const lowestGroup = this.findLowestGroup(quotaData.groups);
        if (lowestGroup) {
            if (lowestGroup.percentage < criticalThreshold) {
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else if (lowestGroup.percentage < warningThreshold) {
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            } else {
                this.statusBarItem.backgroundColor = undefined;
            }
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
     * 构建 Tooltip - 只显示分组信息
     */
    private buildTooltip(
        groups: QuotaGroup[],
        warningThreshold: number,
        criticalThreshold: number
    ): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        md.appendMarkdown(`## 🚀 AG Token 配额概览\n\n`);

        for (const group of groups) {
            const emoji = this.getStatusEmoji(group.percentage, warningThreshold, criticalThreshold);
            md.appendMarkdown(`${emoji} **${group.displayName}**: ${group.percentage}%`);
            if (group.resetCountdown) {
                md.appendMarkdown(` (${group.resetCountdown} 后重置)`);
            }
            md.appendMarkdown(`\n\n`);
        }

        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(`<p align="center"><em>点击查看详情 👇</em></p>`);

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
