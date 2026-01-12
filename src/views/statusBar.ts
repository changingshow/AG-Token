/**
 * 状态栏管理器
 * 支持 cyber 和 classic 两种主题风格
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
        this.setLoading();
    }

    update(quotaData: QuotaData): void {
        const config = vscode.workspace.getConfiguration('agToken');
        const warningThreshold = config.get<number>('warningThreshold', 30);
        const criticalThreshold = config.get<number>('criticalThreshold', 10);
        const theme = config.get<string>('theme', 'cyber');

        if (quotaData.error) {
            this.setErrorState(quotaData.error, theme);
            return;
        }

        if (quotaData.isForbidden) {
            this.setErrorState('无权限访问', theme);
            return;
        }

        if (!quotaData.groups || quotaData.groups.length === 0) {
            this.statusBarItem.text = '$(dash) AG';
            this.statusBarItem.tooltip = '暂无配额数据';
            this.statusBarItem.backgroundColor = undefined;
            return;
        }

        // 图标配置
        const iconLeft = config.get<string>('icon', 'pulse');
        const iconRight = config.get<string>('iconRight', 'none');
        const leftIcon = (iconLeft && iconLeft !== 'none') ? `$(${iconLeft}) ` : '';
        const rightIcon = (iconRight && iconRight !== 'none') ? ` $(${iconRight})` : '';

        // 状态栏文字
        const parts = quotaData.groups.map(g => `${g.displayName} ${g.percentage}%`);
        this.statusBarItem.text = `${leftIcon}${parts.join('  |  ')}${rightIcon}`;

        // 颜色
        const lowestPct = Math.min(...quotaData.groups.map(g => g.percentage));

        if (theme === 'cyber') {
            if (lowestPct < criticalThreshold) {
                this.statusBarItem.color = '#e06c75'; // 柔和红
            } else if (lowestPct < warningThreshold) {
                this.statusBarItem.color = '#e5c07b'; // 柔和黄
            } else {
                this.statusBarItem.color = '#98c379'; // 柔和绿
            }
        } else {
            if (lowestPct < criticalThreshold) {
                this.statusBarItem.color = new vscode.ThemeColor('charts.red');
            } else if (lowestPct < warningThreshold) {
                this.statusBarItem.color = new vscode.ThemeColor('charts.yellow');
            } else {
                this.statusBarItem.color = new vscode.ThemeColor('charts.green');
            }
        }

        this.statusBarItem.backgroundColor = undefined;

        // Tooltip
        this.statusBarItem.tooltip = theme === 'cyber'
            ? this.buildCyberTooltip(quotaData.groups, warningThreshold, criticalThreshold)
            : this.buildClassicTooltip(quotaData.groups, warningThreshold, criticalThreshold);
    }

    setLoading(): void {
        const config = vscode.workspace.getConfiguration('agToken');
        const theme = config.get<string>('theme', 'cyber');
        this.statusBarItem.text = '$(loading~spin) AG Token';
        this.statusBarItem.color = theme === 'cyber' ? '#61afef' : new vscode.ThemeColor('textLink.foreground');
        this.statusBarItem.tooltip = '正在刷新...';
        this.statusBarItem.backgroundColor = undefined;
    }

    private setErrorState(error: string, theme: string): void {
        this.statusBarItem.text = '$(error) AG Error';
        this.statusBarItem.color = theme === 'cyber' ? '#e06c75' : new vscode.ThemeColor('charts.red');
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');

        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.appendMarkdown(`**错误:** ${error}\n\n点击重试`);
        this.statusBarItem.tooltip = md;
    }

    /**
     * Cyber 风格 Tooltip
     */
    private buildCyberTooltip(
        groups: QuotaGroup[],
        warning: number,
        critical: number
    ): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportThemeIcons = true;

        md.appendMarkdown(`## $(pulse) AG Token\n\n`);

        for (const group of groups) {
            const pct = group.percentage;
            const reset = group.resetCountdown || '∞';
            
            let statusIcon = '$(pass)';
            if (pct < critical) statusIcon = '$(error)';
            else if (pct < warning) statusIcon = '$(warning)';

            const bar = this.renderBar(pct);

            md.appendMarkdown(`${statusIcon} **${group.displayName}** \`${bar}\` **${pct}%** $(clock) ${reset}\n\n`);
        }

        md.appendMarkdown(`---\n\n$(link-external) 点击查看详情`);

        return md;
    }

    /**
     * Classic 风格 Tooltip
     */
    private buildClassicTooltip(
        groups: QuotaGroup[],
        warning: number,
        critical: number
    ): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportThemeIcons = true;

        md.appendMarkdown(`## AG Token\n\n`);

        for (const group of groups) {
            const pct = group.percentage;
            const icon = pct < critical ? '🔴' : pct < warning ? '🟡' : '🟢';
            const reset = group.resetCountdown || '-';
            const bar = this.renderBar(pct);
            md.appendMarkdown(`${icon} **${group.displayName}** \`${bar}\` **${pct}%** ⏱ ${reset}\n\n`);
        }

        md.appendMarkdown(`---\n\n$(info) 点击查看详情`);
        return md;
    }

    /**
     * 渲染进度条
     */
    private renderBar(pct: number): string {
        const total = 10;
        const filled = Math.round((pct / 100) * total);
        return '■'.repeat(filled) + '□'.repeat(total - filled);
    }

    dispose(): void {
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
