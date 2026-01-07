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
        this.setLoading();
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
            this.setErrorState('Error', quotaData.error);
            return;
        }

        // 处理 403 禁止访问
        if (quotaData.isForbidden) {
            this.setErrorState('Auth', '账号无权限访问配额 API');
            return;
        }

        // 处理无数据
        if (!quotaData.groups || quotaData.groups.length === 0) {
            this.statusBarItem.text = '$(dash) AG';
            this.statusBarItem.tooltip = '暂无配额数据';
            this.statusBarItem.backgroundColor = undefined;
            return;
        }

        // 0. 获取图标配置
        let iconLeft = config.get<string>('icon', 'pulse');
        let iconRight = config.get<string>('iconRight', 'none');

        // 处理 'none'
        const leftIconText = (iconLeft && iconLeft !== 'none') ? `$(${iconLeft}) ` : '';
        const rightIconText = (iconRight && iconRight !== 'none') ? ` $(${iconRight})` : '';

        // 1. 设置 Status Bar Text (多组显示)
        // Format: "Claude 50%  Gemini 80%"
        const parts: string[] = [];
        for (const group of quotaData.groups) {
            // 直接使用完整名称，不进行缩写
            let label = group.displayName;

            // 状态图标 (文本内的状态，保留为 alert/error/check)
            let icon = '$(check)';
            if (group.percentage < criticalThreshold) icon = '$(error)';
            else if (group.percentage < warningThreshold) icon = '$(alert)';

            parts.push(`${label} ${group.percentage}%`);
        }

        // 使用间隔符号
        this.statusBarItem.text = `${leftIconText}${parts.join('   ')}${rightIconText}`;

        // 找到最低配额以决定整体颜色
        const lowestGroup = this.findLowestGroup(quotaData.groups);
        const lowestPct = lowestGroup ? lowestGroup.percentage : 100;

        // 根据不同的额度剩余 显示不同的颜色 (文字/图标颜色)
        if (lowestPct < criticalThreshold) {
            this.statusBarItem.color = new vscode.ThemeColor('charts.red');
        } else if (lowestPct < warningThreshold) {
            this.statusBarItem.color = new vscode.ThemeColor('charts.yellow');
        } else {
            // 正常状态显示绿色
            // 回退到 charts.green (原始版本)
            this.statusBarItem.color = new vscode.ThemeColor('charts.green');
        }

        // 设置背景色 (保留作为强提示，如果觉得太强可以移除)
        // 既然用户要求了"显示不同的颜色"，文字颜色变化可能足够了，但保留背景色更安全
        const hasCritical = quotaData.groups.some(g => g.percentage < criticalThreshold);
        const hasWarning = quotaData.groups.some(g => g.percentage < warningThreshold);

        if (hasCritical) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            // 在错误背景下，为了确保对比度，通常文字用白色。但用户要求"不同颜色"，
            // 我们保留 charts.red 可能会在红色背景上看不清。
            // 策略：如果有背景色，强制文字为默认(白色)以保证可读性；或者只改变背景。
            // 用户的需求是 "Status Bar 根据不同的额度剩余 显示不同的颜色"，可能就是指文字颜色。
            // 如果我用了背景色，文字颜色就很难搞了。
            // 让我们**移除**背景色逻辑，完全依靠文字颜色 (charts.red/yellow/green) 来表达状态，
            // 这样更符合 "Unified + Minimal" 的设计理念，也不会让状态栏太突兀。
            this.statusBarItem.backgroundColor = undefined;
        } else if (hasWarning) {
            // 同上，移除背景色，仅用文字颜色
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }

        // 2. 设置 Tooltip (结构化信息)
        this.statusBarItem.tooltip = this.buildTooltip(quotaData.groups, warningThreshold, criticalThreshold);
    }

    /**
     * 设置加载状态
     */
    setLoading(): void {
        this.statusBarItem.text = '$(loading~spin) AG Token';
        this.statusBarItem.color = new vscode.ThemeColor('textLink.foreground');
        this.statusBarItem.tooltip = '正在刷新配额...';
        this.statusBarItem.backgroundColor = undefined;
    }

    /**
     * 设置错误状态
     */
    private setErrorState(shortLabel: string, detailedError: string): void {
        this.statusBarItem.text = `$(error) ${shortLabel}`;
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.appendMarkdown(`### ⚠️ 系统警告\n\n`);
        md.appendMarkdown(`**${detailedError}**\n\n`);
        md.appendMarkdown(`--- \n点击重试`);
        this.statusBarItem.tooltip = md;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
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
     * 生成字符进度条
     * @param percentage 0-100
     * @param length 字符长度 (默认为 10)
     */
    private renderProgressBar(percentage: number, length: number = 10): string {
        const filledLength = Math.round((percentage / 100) * length);
        const emptyLength = length - filledLength;
        // 使用 Block Element 字符: █ ▓ ▒ ░
        // 推荐: 实心 '█' 或 阴影 '▓' + 虚线 '░'
        const filledChar = '▓';
        const emptyChar = '░';
        return filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength);
    }



    /**
     * 构建结构化 Tooltip
     * 注意：VS Code Tooltip 中的 ThemeIcon 有时需要严格格式，这里尽量用纯文本或 Emoji 保证兼容性
     */
    private buildTooltip(
        groups: QuotaGroup[],
        warningThreshold: number,
        criticalThreshold: number
    ): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportThemeIcons = true; // 显式允许 Theme Icons
        md.supportHtml = true;

        // Header
        // md.appendMarkdown(`**Antigravity** &nbsp;|&nbsp; 运行中\n\n`);
        // md.appendMarkdown(`---\n\n`);

        // Body: Table
        // 由于 API 只返回 percentage，没有具体 Token 数值，我们合并展示
        // Format: Channel | Usage (Bar + %) | Reset

        md.appendMarkdown(`| 渠道 | 用量 | 重置 |\n`);
        md.appendMarkdown(`| :--- | :--- | :--- |\n`);

        for (const group of groups) {
            // Status Icon
            let statusIcon = '🟢';
            if (group.percentage < criticalThreshold) statusIcon = '🔴';
            else if (group.percentage < warningThreshold) statusIcon = '🟡';

            // Progress Bar
            const bar = this.renderProgressBar(group.percentage, 5);

            // Name
            const name = `**${group.displayName}**`;

            // Usage
            const usage = `${bar} \`${group.percentage}%\``;

            // Reset Time
            const reset = group.resetCountdown ? `\`${group.resetCountdown}\`` : '-';

            md.appendMarkdown(`| ${statusIcon} ${name} | ${usage} | ${reset} |\n`);
        }

        md.appendMarkdown(`\n---\n`);
        md.appendMarkdown(`$(dashboard)点击状态栏打开仪表盘`);

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
