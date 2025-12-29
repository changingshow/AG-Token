/**
 * Webview 面板
 * 显示配额详情的 Webview 面板 - 优化版
 */

import * as vscode from 'vscode';
import type { QuotaData } from '../models/quota';

export class QuotaPanel {
  public static currentPanel: QuotaPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _quotaData: QuotaData;

  /**
   * 创建或显示面板
   */
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

    // 设置面板图标
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
        }
      },
      null,
      this._disposables
    );
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

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>AG Token</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-widget-border);
      --accent-color: var(--vscode-focusBorder);
      
      --success: #10B981;
      --success-light: rgba(16, 185, 129, 0.15);
      --warning: #F59E0B;
      --warning-light: rgba(245, 158, 11, 0.15);
      --critical: #EF4444;
      --critical-light: rgba(239, 68, 68, 0.15);
      
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 16px;
      
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.12);
      --shadow-lg: 0 8px 24px rgba(0,0,0,0.16);
      
      --transition-fast: 0.15s ease;
      --transition-normal: 0.25s ease;
      --transition-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.5;
    }

    /* 主容器 */
    .app {
      max-width: 900px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    /* 头部区域 */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: var(--shadow-sm);
    }

    .logo-text {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .logo-text span {
      opacity: 0.6;
      font-weight: 400;
    }

    /* 控制按钮组 */
    .controls {
      display: flex;
      gap: 8px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn:hover {
      background: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn-icon {
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
    }

    .btn-icon:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--text-primary);
    }

    .btn .icon {
      display: inline-block;
    }

    .btn.loading .icon {
      display: none;
    }

    .btn .spinner {
      display: none;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .btn.loading .spinner {
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* 统计概览区 */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      font-feature-settings: "tnum";
    }

    .stat-value.success { color: var(--success); }
    .stat-value.warning { color: var(--warning); }
    .stat-value.critical { color: var(--critical); }

    /* 配额卡片列表 */
    .quota-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .quota-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: all var(--transition-normal);
    }

    .quota-card:hover {
      border-color: var(--accent-color);
      box-shadow: var(--shadow-md);
    }

    /* 卡片头部 (summary) */
    .quota-card summary {
      list-style: none;
      cursor: pointer;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      transition: background var(--transition-fast);
    }

    .quota-card summary::-webkit-details-marker { display: none; }

    .quota-card summary:hover {
      background: rgba(128, 128, 128, 0.04);
    }

    /* 状态指示器 */
    .status-indicator {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .status-indicator.success {
      background: var(--success-light);
      color: var(--success);
    }

    .status-indicator.warning {
      background: var(--warning-light);
      color: var(--warning);
    }

    .status-indicator.critical {
      background: var(--critical-light);
      color: var(--critical);
    }

    /* 卡片信息区 */
    .quota-info {
      flex: 1;
      min-width: 0;
    }

    .quota-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .quota-meta {
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .quota-meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* 进度条区域 */
    .progress-area {
      flex: 1;
      max-width: 300px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 8px;
    }

    .progress-percent {
      font-size: 24px;
      font-weight: 700;
      font-feature-settings: "tnum";
    }

    .progress-percent.success { color: var(--success); }
    .progress-percent.warning { color: var(--warning); }
    .progress-percent.critical { color: var(--critical); }

    .progress-reset {
      font-size: 11px;
      color: var(--text-secondary);
    }

    .progress-track {
      height: 8px;
      background: rgba(128, 128, 128, 0.15);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.8s var(--transition-slow);
    }

    .progress-fill.success { background: linear-gradient(90deg, #10B981, #34D399); }
    .progress-fill.warning { background: linear-gradient(90deg, #F59E0B, #FBBF24); }
    .progress-fill.critical { background: linear-gradient(90deg, #EF4444, #F87171); }

    /* 展开箭头 */
    .expand-arrow {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      transition: transform var(--transition-normal);
      flex-shrink: 0;
    }

    details[open] .expand-arrow {
      transform: rotate(180deg);
    }

    /* 模型列表 */
    .model-list {
      border-top: 1px solid var(--border-color);
      background: rgba(0, 0, 0, 0.02);
      padding: 8px 0;
      animation: slideDown var(--transition-normal);
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .model-item {
      padding: 12px 24px 12px 92px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background var(--transition-fast);
    }

    .model-item:hover {
      background: rgba(128, 128, 128, 0.05);
    }

    .model-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-secondary);
      opacity: 0.5;
    }

    .model-name {
      font-size: 13px;
      font-weight: 500;
    }

    .model-id {
      font-size: 11px;
      color: var(--text-secondary);
      font-family: 'SF Mono', Consolas, monospace;
    }

    /* 错误提示 */
    .error-banner {
      background: var(--critical-light);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--critical);
    }

    .error-icon { font-size: 20px; }

    /* 空状态 */
    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: var(--text-secondary);
    }

    .empty-icon {
      font-size: 56px;
      margin-bottom: 16px;
      opacity: 0.4;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary);
    }

    /* 页脚 */
    .footer {
      text-align: center;
      padding-top: 32px;
      margin-top: 32px;
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-secondary);
    }

    .hidden { display: none !important; }

    /* 响应式 */
    @media (max-width: 600px) {
      .quota-card summary {
        flex-wrap: wrap;
        gap: 16px;
      }
      .progress-area {
        width: 100%;
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <!-- 头部 -->
    <header class="header">
      <div class="logo">
        <div class="logo-icon">🚀</div>
        <div class="logo-text">AG Token</div>
      </div>
      <div class="controls">
        <button class="btn" id="refreshBtn" onclick="refresh()">
          <span class="icon">🔄</span>
          <span class="spinner"></span>
          <span>刷新</span>
        </button>
        <button class="btn btn-icon" onclick="openSettings()" title="设置">⚙️</button>
      </div>
    </header>

    <!-- 错误提示 -->
    <div id="errorBanner" class="error-banner hidden">
      <span class="error-icon">⚠️</span>
      <span id="errorText"></span>
    </div>

    <!-- 统计概览 -->
    <div id="statsBar" class="stats-bar"></div>

    <!-- 空状态 -->
    <div id="emptyState" class="empty-state hidden">
      <div class="empty-icon">📊</div>
      <div class="empty-title">暂无配额数据</div>
      <p>点击刷新按钮获取最新信息</p>
    </div>

    <!-- 配额列表 -->
    <div id="quotaList" class="quota-list"></div>

    <!-- 页脚 -->
    <footer id="footer" class="footer"></footer>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const warningThreshold = ${warningThreshold};
    const criticalThreshold = ${criticalThreshold};
    
    let quotaData = ${JSON.stringify(this._quotaData)};
    let isLoading = false;
    
    renderQuota(quotaData);
    
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'updateQuota') {
        quotaData = msg.data;
        renderQuota(quotaData);
      } else if (msg.command === 'setLoading') {
        setLoading(msg.loading);
      }
    });
    
    function refresh() {
      if (isLoading) return;
      setLoading(true);
      vscode.postMessage({ command: 'refresh' });
    }
    
    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }
    
    function setLoading(loading) {
      isLoading = loading;
      const btn = document.getElementById('refreshBtn');
      btn.classList.toggle('loading', loading);
      btn.disabled = loading;
    }
    
    function getType(pct) {
      if (pct < criticalThreshold) return 'critical';
      if (pct < warningThreshold) return 'warning';
      return 'success';
    }
    
    function renderQuota(data) {
      setLoading(false);
      
      const errorBanner = document.getElementById('errorBanner');
      const statsBar = document.getElementById('statsBar');
      const quotaList = document.getElementById('quotaList');
      const emptyState = document.getElementById('emptyState');
      const footer = document.getElementById('footer');
      
      // 处理错误
      if (data.error) {
        errorBanner.classList.remove('hidden');
        document.getElementById('errorText').textContent = data.error;
      } else {
        errorBanner.classList.add('hidden');
      }
      
      const groups = data.groups || [];
      
      if (!groups.length && !data.error) {
        statsBar.innerHTML = '';
        quotaList.innerHTML = '';
        emptyState.classList.remove('hidden');
        footer.textContent = '';
        return;
      }
      
      emptyState.classList.add('hidden');
      
      // 统计概览
      const lowestPct = groups.length ? Math.min(...groups.map(g => g.percentage)) : 100;
      const avgPct = groups.length ? Math.round(groups.reduce((a, g) => a + g.percentage, 0) / groups.length) : 0;
      const lowestType = getType(lowestPct);
      
      statsBar.innerHTML = \`
        <div class="stat-card">
          <div class="stat-label">最低配额</div>
          <div class="stat-value \${lowestType}">\${lowestPct}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均配额</div>
          <div class="stat-value">\${avgPct}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">配额组数</div>
          <div class="stat-value">\${groups.length}</div>
        </div>
      \`;
      
      // 配额列表
      quotaList.innerHTML = groups.map(group => {
        const type = getType(group.percentage);
        
        const modelsHtml = group.items.map(item => \`
          <div class="model-item">
            <div class="model-dot"></div>
            <div>
              <div class="model-name">\${item.displayName}</div>
              <div class="model-id">\${item.name}</div>
            </div>
          </div>
        \`).join('');

        return \`
          <details class="quota-card" \${group.items.length === 1 ? 'open' : ''}>
            <summary>
              <div class="status-indicator \${type}">\${group.percentage}</div>
              
              <div class="quota-info">
                <div class="quota-title">
                  \${group.displayName}
                </div>
                <div class="quota-meta">
                  <span class="quota-meta-item">📦 \${group.items.length} 个模型</span>
                  <span class="quota-meta-item">⏰ \${group.resetCountdown}</span>
                </div>
              </div>
              
              <div class="progress-area">
                <div class="progress-header">
                  <span class="progress-percent \${type}">\${group.percentage}%</span>
                  <span class="progress-reset">剩余配额</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill \${type}" style="width: \${group.percentage}%"></div>
                </div>
              </div>
              
              <div class="expand-arrow">▼</div>
            </summary>
            
            <div class="model-list">
              \${modelsHtml}
            </div>
          </details>
        \`;
      }).join('');
      
      // 页脚
      if (data.lastUpdated) {
        footer.textContent = '最后更新: ' + new Date(data.lastUpdated).toLocaleString('zh-CN');
      }
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
