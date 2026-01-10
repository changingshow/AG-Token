/**
 * Webview 面板
 * 显示配额详情的 Webview 面板
 */

import * as vscode from 'vscode';
import type { QuotaData } from '../models/quota';

export class QuotaPanel {
  public static currentPanel: QuotaPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _quotaData: QuotaData;

  public static createOrShow(
    extensionUri: vscode.Uri,
    quotaData: QuotaData,
    onRefresh: () => void
  ): QuotaPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (QuotaPanel.currentPanel) {
      QuotaPanel.currentPanel._panel.reveal(column);
      QuotaPanel.currentPanel.update(quotaData);
      return QuotaPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'agToken',
      'AG Token',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'icon.png');

    QuotaPanel.currentPanel = new QuotaPanel(panel, extensionUri, quotaData, onRefresh);
    return QuotaPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    quotaData: QuotaData,
    onRefresh: () => void
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._quotaData = quotaData;

    this._panel.webview.html = this._getHtmlContent();

    vscode.commands.executeCommand('setContext', 'agToken.panelActive', true);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'refresh':
            onRefresh();
            break;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'agToken');
            break;
          case 'openGithub':
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/changingshow/AG-Token'));
            break;
        }
      },
      null,
      this._disposables
    );

    // 监听配置变化，刷新主题
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('agToken.theme')) {
        this._panel.webview.html = this._getHtmlContent();
      }
    }, null, this._disposables);
  }

  public update(quotaData: QuotaData): void {
    this._quotaData = quotaData;
    this._panel.webview.postMessage({
      command: 'updateQuota',
      data: quotaData,
    });
  }

  public setLoading(loading: boolean): void {
    this._panel.webview.postMessage({
      command: 'setLoading',
      loading,
    });
  }

  private _getHtmlContent(): string {
    const config = vscode.workspace.getConfiguration('agToken');
    const warningThreshold = config.get<number>('warningThreshold', 30);
    const criticalThreshold = config.get<number>('criticalThreshold', 10);
    const theme = config.get<string>('theme', 'cyber');

    const iconUri = this._panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.png')
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${this._panel.webview.cspSource};">
  <title>AG Token</title>
  <style>
    /* ========== 基础变量 ========== */
    :root {
      /* Classic 主题 - 跟随 VSCode */
      --classic-bg-primary: var(--vscode-editor-background);
      --classic-bg-secondary: var(--vscode-editorWidget-background);
      --classic-text-primary: var(--vscode-editor-foreground);
      --classic-text-secondary: var(--vscode-descriptionForeground);
      --classic-border-color: var(--vscode-widget-border);
      --classic-accent-color: var(--vscode-textLink-foreground);
      --classic-hover-bg: var(--vscode-list-hoverBackground);
      
      /* Cyber 主题 - 赛博朋克 */
      --cyber-bg-primary: #0a0a0f;
      --cyber-bg-secondary: #12121a;
      --cyber-text-primary: #ffffff;
      --cyber-text-secondary: rgba(255, 255, 255, 0.7);
      --cyber-text-muted: rgba(255, 255, 255, 0.4);
      --cyber-neon-cyan: #00f5ff;
      --cyber-neon-purple: #bf00ff;
      --cyber-neon-pink: #ff00aa;
      --cyber-neon-green: #00ff88;
      --cyber-neon-yellow: #ffee00;
      --cyber-neon-red: #ff0055;
      
      /* 共享状态颜色 */
      --color-success: #3fb950;
      --color-warning: #d29922;
      --color-error: #f85149;
      
      --radius-lg: 12px;
      --radius-md: 8px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      height: 100vh;
      overflow: hidden;
      line-height: 1.6;
    }

    /* ========== Classic 主题样式 ========== */
    body[data-theme="classic"] {
      background-color: var(--classic-bg-primary);
      color: var(--classic-text-primary);
      font-size: 13px;
    }

    [data-theme="classic"] .layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 900px;
      margin: 0 auto;
    }

    [data-theme="classic"] .header {
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 32px 24px 24px;
      border-bottom: 1px solid var(--classic-border-color);
      background: var(--classic-bg-primary);
    }

    [data-theme="classic"] .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    [data-theme="classic"] .brand-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    [data-theme="classic"] .brand-icon img {
      width: 100%;
      height: 100%;
      border-radius: 12px;
    }

    [data-theme="classic"] .brand-text h1 {
      font-size: 24px;
      font-weight: 500;
      letter-spacing: -0.5px;
    }

    [data-theme="classic"] .brand-text p {
      color: var(--classic-text-secondary);
      font-size: 13px;
    }

    [data-theme="classic"] .actions {
      display: flex;
      gap: 12px;
    }

    [data-theme="classic"] .btn {
      background: var(--classic-bg-secondary);
      border: 1px solid var(--classic-border-color);
      color: var(--classic-text-primary);
      padding: 6px 12px;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    [data-theme="classic"] .btn:hover {
      background: var(--classic-hover-bg);
    }

    [data-theme="classic"] .btn svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
    }

    [data-theme="classic"] .btn.loading svg {
      animation: spin 1s linear infinite;
    }

    [data-theme="classic"] .btn-icon {
      padding: 6px;
      width: 32px;
      height: 32px;
      justify-content: center;
    }

    [data-theme="classic"] .content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      scrollbar-width: thin;
    }

    [data-theme="classic"] .section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--classic-text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }

    [data-theme="classic"] .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    [data-theme="classic"] .card {
      background: var(--classic-bg-secondary);
      border: 1px solid var(--classic-border-color);
      border-radius: var(--radius-lg);
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    [data-theme="classic"] .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      border-color: var(--classic-accent-color);
    }

    [data-theme="classic"] .card-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    [data-theme="classic"] .card-name {
      font-weight: 600;
      font-size: 14px;
    }

    [data-theme="classic"] .card-reset {
      font-size: 11px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    [data-theme="classic"] .ring-wrap {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: conic-gradient(var(--ring-color, var(--color-success)) var(--progress, 0%), rgba(128,128,128,0.2) 0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      position: relative;
    }

    [data-theme="classic"] .ring-inner {
      width: 86px;
      height: 86px;
      background: var(--classic-bg-secondary);
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    [data-theme="classic"] .ring-inner .ring-value {
      font-size: 20px;
      font-weight: 700;
      font-family: 'SF Mono', Consolas, monospace;
      position: static;
      text-shadow: none;
    }

    [data-theme="classic"] .ring-label {
      font-size: 12px;
      color: var(--classic-text-secondary);
    }

    [data-theme="classic"] .ring-svg { display: none; }
    [data-theme="classic"] .ring-wrap > .ring-value { display: none; }
    [data-theme="classic"] .card-info { display: none; }

    [data-theme="classic"] .details {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    [data-theme="classic"] .group {
      background: var(--classic-bg-secondary);
      border: 1px solid var(--classic-border-color);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    [data-theme="classic"] .group-header {
      padding: 12px 16px;
      background: rgba(128,128,128,0.03);
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: background 0.2s;
    }

    [data-theme="classic"] .group-header:hover {
      background: var(--classic-hover-bg);
    }

    [data-theme="classic"] .group-left,
    [data-theme="classic"] .group-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    [data-theme="classic"] .group-icon { display: none; }

    [data-theme="classic"] .group-chevron {
      font-size: 10px;
      color: var(--classic-text-secondary);
      transition: transform 0.2s;
    }

    [data-theme="classic"] .group-chevron svg {
      width: 12px;
      height: 12px;
    }

    [data-theme="classic"] .group.expanded .group-chevron {
      transform: rotate(90deg);
    }

    [data-theme="classic"] .group-name {
      font-weight: 600;
    }

    [data-theme="classic"] .group-pct {
      font-weight: bold;
    }

    [data-theme="classic"] .group-reset {
      font-family: monospace;
      font-size: 11px;
      color: var(--classic-text-secondary);
      background: var(--classic-bg-primary);
      padding: 2px 6px;
      border-radius: 4px;
    }

    [data-theme="classic"] .group-body {
      display: none;
      background: var(--classic-bg-primary);
    }

    [data-theme="classic"] .group.expanded .group-body {
      display: block;
    }

    [data-theme="classic"] .model-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 16px 10px 32px;
      border-bottom: 1px solid var(--classic-border-color);
      font-size: 13px;
    }

    [data-theme="classic"] .model-item:last-child {
      border-bottom: none;
    }

    [data-theme="classic"] .model-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    [data-theme="classic"] .model-name {
      font-weight: 500;
    }

    [data-theme="classic"] .model-id {
      font-size: 11px;
      color: var(--classic-text-secondary);
    }

    [data-theme="classic"] .model-stats {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    [data-theme="classic"] .model-pct {
      font-family: monospace;
      font-weight: bold;
      min-width: 45px;
      text-align: right;
    }

    [data-theme="classic"] .model-bar {
      width: 80px;
      height: 6px;
      background: rgba(128,128,128,0.2);
      border-radius: 3px;
      overflow: hidden;
    }

    [data-theme="classic"] .model-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s;
    }

    [data-theme="classic"] .footer {
      flex-shrink: 0;
      padding: 16px 24px;
      border-top: 1px solid var(--classic-border-color);
      background: var(--classic-bg-primary);
      text-align: center;
    }

    [data-theme="classic"] .footer-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--classic-text-secondary);
      text-decoration: none;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 20px;
      transition: all 0.2s;
      cursor: pointer;
    }

    [data-theme="classic"] .footer-link:hover {
      background: var(--classic-hover-bg);
      color: var(--classic-text-primary);
    }

    [data-theme="classic"] .footer-link svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    [data-theme="classic"] .empty {
      text-align: center;
      padding: 60px;
      color: var(--classic-text-secondary);
    }

    [data-theme="classic"] .empty-icon {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    /* ========== Cyber 主题样式 ========== */
    body[data-theme="cyber"] {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 14px;
      background: var(--cyber-bg-primary);
      color: var(--cyber-text-primary);
      position: relative;
    }

    /* Cyber 动态网格背景 */
    [data-theme="cyber"]::before {
      content: '';
      position: fixed;
      inset: 0;
      background: 
        linear-gradient(rgba(0, 245, 255, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 245, 255, 0.08) 1px, transparent 1px);
      background-size: 40px 40px;
      animation: gridMove 20s linear infinite;
      pointer-events: none;
      z-index: 0;
    }

    @keyframes gridMove {
      0% { transform: translate(0, 0); }
      100% { transform: translate(40px, 40px); }
    }

    /* Cyber 光晕背景 */
    [data-theme="cyber"]::after {
      content: '';
      position: fixed;
      inset: 0;
      background: 
        radial-gradient(ellipse 600px 600px at 0% 0%, rgba(0, 245, 255, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse 500px 500px at 100% 0%, rgba(191, 0, 255, 0.12) 0%, transparent 50%),
        radial-gradient(ellipse 400px 400px at 50% 100%, rgba(255, 0, 170, 0.1) 0%, transparent 50%);
      pointer-events: none;
      z-index: 0;
      animation: orbPulse 8s ease-in-out infinite alternate;
    }

    @keyframes orbPulse {
      0% { opacity: 0.6; }
      100% { opacity: 1; }
    }

    [data-theme="cyber"] .layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 1000px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    [data-theme="cyber"] .header {
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 28px;
      background: rgba(10, 10, 15, 0.8);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(0, 245, 255, 0.2);
      position: relative;
    }

    [data-theme="cyber"] .header::before {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--cyber-neon-cyan), var(--cyber-neon-purple), var(--cyber-neon-pink), transparent);
      animation: borderGlow 3s linear infinite;
    }

    @keyframes borderGlow {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    [data-theme="cyber"] .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    [data-theme="cyber"] .brand-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--cyber-neon-cyan), var(--cyber-neon-purple), var(--cyber-neon-pink));
      padding: 2px;
      position: relative;
      animation: iconPulse 2s ease-in-out infinite;
    }

    [data-theme="cyber"] .brand-icon::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--cyber-neon-cyan), var(--cyber-neon-purple), var(--cyber-neon-pink));
      z-index: -1;
      filter: blur(10px);
      opacity: 0.6;
    }

    @keyframes iconPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }

    [data-theme="cyber"] .brand-icon img {
      width: 100%;
      height: 100%;
      border-radius: 10px;
    }

    [data-theme="cyber"] .brand-text h1 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      background: linear-gradient(135deg, var(--cyber-neon-cyan), var(--cyber-neon-purple), var(--cyber-neon-pink));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    [data-theme="cyber"] .brand-text p {
      font-size: 10px;
      color: var(--cyber-neon-cyan);
      letter-spacing: 3px;
      text-transform: uppercase;
      opacity: 0.8;
    }

    [data-theme="cyber"] .actions {
      display: flex;
      gap: 12px;
    }

    [data-theme="cyber"] .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      font-size: 11px;
      font-weight: 600;
      font-family: inherit;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--cyber-neon-cyan);
      background: rgba(0, 245, 255, 0.05);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    [data-theme="cyber"] .btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, transparent 0%, rgba(0, 245, 255, 0.1) 50%, transparent 100%);
      transform: translateX(-100%);
      transition: transform 0.5s ease;
    }

    [data-theme="cyber"] .btn:hover::before {
      transform: translateX(100%);
    }

    [data-theme="cyber"] .btn:hover {
      color: #fff;
      background: rgba(0, 245, 255, 0.15);
      border-color: var(--cyber-neon-cyan);
      box-shadow: 0 0 20px rgba(0, 245, 255, 0.4), inset 0 0 20px rgba(0, 245, 255, 0.1);
      transform: translateY(-2px);
    }

    [data-theme="cyber"] .btn svg {
      width: 14px;
      height: 14px;
    }

    [data-theme="cyber"] .btn.loading svg {
      animation: spin 0.8s linear infinite;
    }

    [data-theme="cyber"] .btn-icon {
      padding: 10px;
      width: 38px;
      height: 38px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    [data-theme="cyber"] .content {
      flex: 1;
      overflow-y: auto;
      padding: 24px 28px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 245, 255, 0.3) transparent;
    }

    [data-theme="cyber"] .content::-webkit-scrollbar { width: 4px; }
    [data-theme="cyber"] .content::-webkit-scrollbar-thumb { 
      background: linear-gradient(180deg, var(--cyber-neon-cyan), var(--cyber-neon-purple)); 
      border-radius: 2px; 
    }

    [data-theme="cyber"] .section-title {
      font-size: 10px;
      font-weight: 700;
      color: var(--cyber-neon-cyan);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
    }

    [data-theme="cyber"] .section-title::before {
      content: '//';
      color: var(--cyber-neon-purple);
    }

    [data-theme="cyber"] .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(0, 245, 255, 0.5), transparent);
    }

    [data-theme="cyber"] .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }

    [data-theme="cyber"] .card {
      position: relative;
      background: linear-gradient(145deg, rgba(20, 20, 30, 0.95) 0%, rgba(12, 12, 18, 0.98) 100%);
      backdrop-filter: blur(20px);
      border: 2px solid var(--card-border, rgba(0, 245, 255, 0.25));
      border-radius: 14px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }

    [data-theme="cyber"] .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--card-accent);
      box-shadow: 0 0 15px var(--card-accent), 0 0 30px var(--card-accent);
    }

    [data-theme="cyber"] .card::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--card-glow) 0%, transparent 50%);
      opacity: 0.3;
      pointer-events: none;
      transition: opacity 0.4s ease;
    }

    [data-theme="cyber"] .card:hover {
      transform: translateY(-6px);
      border-color: var(--card-accent);
      box-shadow: 0 0 30px var(--card-glow), 0 20px 40px rgba(0, 0, 0, 0.4);
    }

    [data-theme="cyber"] .card.status-success { 
      --card-accent: var(--cyber-neon-green); 
      --card-glow: rgba(0, 255, 136, 0.15);
      --card-border: rgba(0, 255, 136, 0.35);
    }
    [data-theme="cyber"] .card.status-warning { 
      --card-accent: var(--cyber-neon-yellow); 
      --card-glow: rgba(255, 238, 0, 0.15);
      --card-border: rgba(255, 238, 0, 0.35);
    }
    [data-theme="cyber"] .card.status-error { 
      --card-accent: var(--cyber-neon-red); 
      --card-glow: rgba(255, 0, 85, 0.15);
      --card-border: rgba(255, 0, 85, 0.35);
    }

    [data-theme="cyber"] .card-header { display: none; }
    [data-theme="cyber"] .ring-inner { display: none; }

    [data-theme="cyber"] .ring-wrap {
      position: relative;
      width: 80px;
      height: 80px;
      flex-shrink: 0;
    }

    [data-theme="cyber"] .ring-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    [data-theme="cyber"] .ring-bg {
      fill: none;
      stroke: rgba(255, 255, 255, 0.1);
      stroke-width: 5;
    }

    [data-theme="cyber"] .ring-progress {
      fill: none;
      stroke-width: 5;
      stroke-linecap: round;
      transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
    }

    [data-theme="cyber"] .ring-value {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 700;
      text-shadow: 0 0 15px currentColor;
    }

    [data-theme="cyber"] .card-info {
      text-align: center;
      width: 100%;
    }

    [data-theme="cyber"] .card-name {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 6px;
      color: var(--cyber-text-primary);
      letter-spacing: 1px;
      text-transform: uppercase;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    }

    [data-theme="cyber"] .card-meta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      color: var(--cyber-text-muted);
    }

    [data-theme="cyber"] .card-reset {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      background: rgba(0, 245, 255, 0.1);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 6px;
      font-size: 11px;
      color: var(--cyber-neon-cyan);
      text-shadow: 0 0 5px var(--cyber-neon-cyan);
    }

    [data-theme="cyber"] .card-reset svg {
      width: 11px;
      height: 11px;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }

    [data-theme="cyber"] .details {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    [data-theme="cyber"] .group {
      background: linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(10, 10, 15, 0.95) 100%);
      border: 1px solid rgba(0, 245, 255, 0.15);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.3s ease;
      position: relative;
    }

    [data-theme="cyber"] .group::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--cyber-neon-cyan), transparent);
      opacity: 0.5;
    }

    [data-theme="cyber"] .group:hover {
      border-color: rgba(0, 245, 255, 0.4);
      box-shadow: 0 0 30px rgba(0, 245, 255, 0.15);
    }

    [data-theme="cyber"] .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    [data-theme="cyber"] .group-header:hover {
      background: rgba(0, 245, 255, 0.05);
    }

    [data-theme="cyber"] .group-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    [data-theme="cyber"] .group-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    [data-theme="cyber"] .group-icon.success { 
      background: linear-gradient(135deg, var(--cyber-neon-green) 0%, var(--cyber-neon-cyan) 100%);
      color: #000;
      box-shadow: 0 0 20px rgba(0, 255, 136, 0.6);
    }
    [data-theme="cyber"] .group-icon.warning { 
      background: linear-gradient(135deg, var(--cyber-neon-yellow) 0%, #ff6600 100%);
      color: #000;
      box-shadow: 0 0 20px rgba(255, 238, 0, 0.6);
    }
    [data-theme="cyber"] .group-icon.error { 
      background: linear-gradient(135deg, var(--cyber-neon-red) 0%, var(--cyber-neon-purple) 100%);
      color: #fff;
      box-shadow: 0 0 20px rgba(255, 0, 85, 0.6);
    }

    [data-theme="cyber"] .group-name {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    [data-theme="cyber"] .group-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    [data-theme="cyber"] .group-pct {
      font-size: 14px;
      font-weight: 700;
      text-shadow: 0 0 10px currentColor;
    }

    [data-theme="cyber"] .group-reset {
      font-size: 10px;
      color: var(--cyber-neon-cyan);
      padding: 5px 12px;
      background: rgba(0, 245, 255, 0.1);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 6px;
      text-shadow: 0 0 5px var(--cyber-neon-cyan);
    }

    [data-theme="cyber"] .group-chevron {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cyber-neon-cyan);
      transition: all 0.3s ease;
      border-radius: 6px;
      background: rgba(0, 245, 255, 0.1);
    }

    [data-theme="cyber"] .group-chevron svg {
      width: 12px;
      height: 12px;
    }

    [data-theme="cyber"] .group.expanded .group-chevron {
      transform: rotate(90deg);
    }

    [data-theme="cyber"] .group-body {
      display: none;
      border-top: 1px solid rgba(0, 245, 255, 0.1);
      background: rgba(0, 0, 0, 0.3);
    }

    [data-theme="cyber"] .group.expanded .group-body {
      display: block;
      animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    [data-theme="cyber"] .model-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px 14px 70px;
      border-bottom: 1px solid rgba(0, 245, 255, 0.05);
      transition: all 0.3s ease;
      position: relative;
    }

    [data-theme="cyber"] .model-item::before {
      content: '';
      position: absolute;
      left: 50px;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--cyber-neon-cyan);
      box-shadow: 0 0 6px var(--cyber-neon-cyan);
    }

    [data-theme="cyber"] .model-item:last-child {
      border-bottom: none;
    }

    [data-theme="cyber"] .model-item:hover {
      background: rgba(0, 245, 255, 0.05);
    }

    [data-theme="cyber"] .model-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    [data-theme="cyber"] .model-name {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    [data-theme="cyber"] .model-id {
      font-size: 9px;
      color: var(--cyber-neon-purple);
      opacity: 0.8;
    }

    [data-theme="cyber"] .model-stats {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    [data-theme="cyber"] .model-pct {
      font-size: 12px;
      font-weight: 700;
      min-width: 48px;
      text-align: right;
      text-shadow: 0 0 8px currentColor;
    }

    [data-theme="cyber"] .model-bar {
      width: 80px;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }

    [data-theme="cyber"] .model-bar::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    [data-theme="cyber"] .model-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 10px currentColor;
    }

    [data-theme="cyber"] .footer {
      flex-shrink: 0;
      padding: 16px 28px;
      border-top: 1px solid rgba(0, 245, 255, 0.2);
      background: rgba(10, 10, 15, 0.9);
      backdrop-filter: blur(20px);
      display: flex;
      justify-content: center;
      position: relative;
    }

    [data-theme="cyber"] .footer::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--cyber-neon-purple), var(--cyber-neon-cyan), transparent);
      opacity: 0.5;
    }

    [data-theme="cyber"] .footer-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--cyber-neon-cyan);
      text-decoration: none;
      padding: 10px 18px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 1px solid rgba(0, 245, 255, 0.2);
      background: rgba(0, 245, 255, 0.05);
    }

    [data-theme="cyber"] .footer-link:hover {
      color: #fff;
      border-color: var(--cyber-neon-cyan);
      box-shadow: 0 0 20px rgba(0, 245, 255, 0.4);
      transform: translateY(-2px);
    }

    [data-theme="cyber"] .footer-link svg {
      width: 14px;
      height: 14px;
    }

    [data-theme="cyber"] .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 100px 40px;
      text-align: center;
      position: relative;
    }

    [data-theme="cyber"] .empty::before {
      content: '';
      position: absolute;
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 245, 255, 0.1) 0%, transparent 70%);
      animation: emptyPulse 3s ease-in-out infinite;
    }

    @keyframes emptyPulse {
      0%, 100% { transform: scale(0.8); opacity: 0.3; }
      50% { transform: scale(1.2); opacity: 0.6; }
    }

    [data-theme="cyber"] .empty-icon {
      width: 80px;
      height: 80px;
      margin-bottom: 24px;
      color: var(--cyber-neon-cyan);
      filter: drop-shadow(0 0 20px var(--cyber-neon-cyan));
      animation: iconFloat 3s ease-in-out infinite;
    }

    @keyframes iconFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    [data-theme="cyber"] .empty-text {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--cyber-neon-cyan);
      text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
    }
  </style>
</head>
<body data-theme="${theme}">
  <div class="layout">
    <header class="header">
      <div class="brand">
        <div class="brand-icon">
          <img src="${iconUri}" alt="AG" />
        </div>
        <div class="brand-text">
          <h1>AG Token</h1>
          <p>配额监控</p>
        </div>
      </div>
      <div class="actions">
        <button class="btn" id="refreshBtn" onclick="refresh()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
          <span>刷新</span>
        </button>
        <button class="btn btn-icon" onclick="openSettings()" title="设置">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>
    </header>

    <main class="content">
      <div class="section-title">概览</div>
      <div id="cards" class="cards"></div>
      
      <div class="section-title">详情</div>
      <div id="details" class="details"></div>
    </main>
    
    <footer class="footer">
      <a class="footer-link" onclick="openGithub()">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
        </svg>
        <span>GitHub 主页</span>
      </a>
    </footer>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const WARNING = ${warningThreshold};
    const CRITICAL = ${criticalThreshold};
    const CIRCUMFERENCE = 2 * Math.PI * 30;
    const THEME = '${theme}';

    window.addEventListener('message', e => {
      if (e.data.command === 'updateQuota') render(e.data.data);
      if (e.data.command === 'setLoading') setLoading(e.data.loading);
    });

    try { render(${JSON.stringify(this._quotaData)}); } catch(e) { console.error(e); }

    function refresh() {
      setLoading(true);
      vscode.postMessage({ command: 'refresh' });
    }
    
    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }

    function openGithub() {
      vscode.postMessage({ command: 'openGithub' });
    }

    function toggleGroup(el) {
      el.closest('.group').classList.toggle('expanded');
    }

    function setLoading(loading) {
      const btn = document.getElementById('refreshBtn');
      if (btn) btn.classList.toggle('loading', loading);
    }

    function getStatus(pct) {
      if (pct < CRITICAL) return 'error';
      if (pct < WARNING) return 'warning';
      return 'success';
    }
    
    function getColor(pct) {
      if (pct < CRITICAL) return THEME === 'cyber' ? 'var(--cyber-neon-red)' : 'var(--color-error)';
      if (pct < WARNING) return THEME === 'cyber' ? 'var(--cyber-neon-yellow)' : 'var(--color-warning)';
      return THEME === 'cyber' ? 'var(--cyber-neon-green)' : 'var(--color-success)';
    }
    
    function getGlow(pct) {
      if (pct < CRITICAL) return 'rgba(255, 0, 85, 0.6)';
      if (pct < WARNING) return 'rgba(255, 238, 0, 0.6)';
      return 'rgba(0, 255, 136, 0.6)';
    }

    function render(data) {
      const cardsEl = document.getElementById('cards');
      const detailsEl = document.getElementById('details');
      
      if (!data || !data.groups || data.groups.length === 0) {
        cardsEl.innerHTML = \`
          <div class="empty">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <p class="empty-text">暂无配额数据</p>
          </div>
        \`;
        detailsEl.innerHTML = '';
        return;
      }

      // Render Cards
      cardsEl.innerHTML = data.groups.map(g => {
        const status = getStatus(g.percentage);
        const color = getColor(g.percentage);
        const glow = getGlow(g.percentage);
        const offset = CIRCUMFERENCE - (g.percentage / 100) * CIRCUMFERENCE;
        const resetText = g.resetCountdown || '--';
        
        return \`
          <div class="card status-\${status}" style="--progress: \${g.percentage}%; --ring-color: \${color};">
            <div class="card-header">
              <span class="card-name">\${g.displayName}</span>
              <span class="card-reset">\${resetText}</span>
            </div>
            <div class="ring-wrap">
              <svg class="ring-svg" viewBox="0 0 72 72" style="--ring-glow: \${glow}">
                <circle class="ring-bg" cx="36" cy="36" r="30"/>
                <circle class="ring-progress" cx="36" cy="36" r="30" 
                  stroke="\${color}"
                  stroke-dasharray="\${CIRCUMFERENCE}" 
                  stroke-dashoffset="\${offset}"/>
              </svg>
              <div class="ring-value" style="color: \${color}">\${g.percentage}%</div>
              <div class="ring-inner">
                <div class="ring-value" style="color: \${color}">\${g.percentage}%</div>
                <div class="ring-label">Tokens</div>
              </div>
            </div>
            <div class="card-info">
              <div class="card-name">\${g.displayName}</div>
              <div class="card-meta">
                <span class="card-reset">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                  \${resetText}
                </span>
              </div>
            </div>
          </div>
        \`;
      }).join('');

      // Render Details
      detailsEl.innerHTML = data.groups.map(g => {
        const status = getStatus(g.percentage);
        const color = getColor(g.percentage);
        const resetText = g.resetCountdown || '';
        
        const items = g.items.map(m => {
          const mStatus = getStatus(m.percentage);
          const mColor = getColor(m.percentage);
          return \`
            <div class="model-item">
              <div class="model-info">
                <div class="model-name">\${m.displayName}</div>
                <div class="model-id">\${m.name}</div>
              </div>
              <div class="model-stats">
                <div class="model-bar">
                  <div class="model-bar-fill" style="width: \${m.percentage}%; background: \${mColor}; color: \${mColor}"></div>
                </div>
                <div class="model-pct" style="color: \${mColor}">\${m.percentage}%</div>
              </div>
            </div>
          \`;
        }).join('');

        return \`
          <div class="group">
            <div class="group-header" onclick="toggleGroup(this)">
              <div class="group-left">
                <div class="group-chevron">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
                <div class="group-icon \${status}">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <span class="group-name">\${g.displayName}</span>
              </div>
              <div class="group-right">
                <span class="group-pct" style="color: \${color}">\${g.percentage}%</span>
                \${resetText ? \`<span class="group-reset">\${resetText}</span>\` : ''}
              </div>
            </div>
            <div class="group-body">\${items}</div>
          </div>
        \`;
      }).join('');
      
      setLoading(false);
    }
  </script>
</body>
</html>`;
  }

  public dispose(): void {
    QuotaPanel.currentPanel = undefined;
    vscode.commands.executeCommand('setContext', 'agToken.panelActive', false);
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}
