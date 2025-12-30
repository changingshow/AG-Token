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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background-color: #f5f5f5;
      background-image: 
        linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      color: #333;
      line-height: 1.5;
      padding: 24px;
      min-height: 100vh;
    }

    .container {
      max-width: 720px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      overflow: hidden;
    }

    .brand-logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .brand-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .brand-subtitle {
      font-size: 12px;
      color: #888;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #fff;
      color: #555;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:hover {
      background: #f0f0f0;
      border-color: #ccc;
    }

    .btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      fill: none;
    }

    .btn.loading svg {
      animation: spin 1s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .icon-btn {
      width: 36px;
      height: 36px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: linear-gradient(135deg, #fff 0%, #eef2ff 100%);
      border: 1px solid #a5b4fc;
      border-radius: 12px;
      padding: 20px 16px;
      text-align: center;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(99,102,241,0.12);
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 40px rgba(99,102,241,0.2);
      border-color: #818cf8;
      background: linear-gradient(135deg, #fff 0%, #e0e7ff 100%);
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
    }

    .stat-value.success { color: #059669; }
    .stat-value.warning { color: #d97706; }
    .stat-value.critical { color: #dc2626; }

    .stat-label {
      font-size: 12px;
      color: #6366f1;
      margin-top: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .group {
      background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      margin-bottom: 12px;
      overflow: hidden;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(99,102,241,0.1);
    }

    .group:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(99,102,241,0.18);
      border-color: #a5b4fc;
    }

    .group.open {
      box-shadow: 0 16px 48px rgba(99,102,241,0.2);
      border-color: #818cf8;
    }

    .group-header {
      display: flex;
      align-items: center;
      padding: 16px;
      cursor: pointer;
      user-select: none;
    }

    .group-header:hover {
      background: #fafafa;
    }

    .group-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin-right: 12px;
    }

    .group-icon.claude { background: #f97316; }
    .group-icon.gemini { background: #3b82f6; }
    .group-icon.openai { background: #10a37f; }
    .group-icon.other { background: #6b7280; }

    .group-info {
      flex: 1;
    }

    .group-name {
      font-size: 15px;
      font-weight: 600;
    }

    .group-meta {
      font-size: 12px;
      color: #888;
      margin-top: 2px;
    }

    .group-percent {
      font-size: 20px;
      font-weight: 700;
      margin-right: 12px;
    }

    .group-percent.success { color: #16a34a; }
    .group-percent.success { color: #059669; }
    .group-percent.warning { color: #d97706; }
    .group-percent.critical { color: #dc2626; }

    .group-arrow {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6366f1;
      font-size: 12px;
    }

    .group.open .group-arrow {
      transform: rotate(180deg);
    }

    .models {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }

    .group.open .models {
      max-height: 800px;
    }

    .models-inner {
      border-top: 1px solid #e2e8f0;
      background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
    }

    .model {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #f0f4f8;
      transition: background 0.2s;
    }

    .model:hover {
      background: rgba(99,102,241,0.04);
    }

    .model:last-child {
      border-bottom: none;
    }

    .model-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 12px;
      box-shadow: 0 0 8px currentColor;
    }

    .model-status.success { background: #10b981; color: #10b981; }
    .model-status.warning { background: #f59e0b; color: #f59e0b; }
    .model-status.critical { background: #ef4444; color: #ef4444; }

    .model-info {
      flex: 1;
    }

    .model-name {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }

    .model-id {
      font-size: 11px;
      color: #64748b;
      font-family: monospace;
    }

    .model-percent {
      font-size: 14px;
      font-weight: 600;
      margin-right: 12px;
    }

    .model-percent.success { color: #059669; }
    .model-percent.warning { color: #d97706; }
    .model-percent.critical { color: #dc2626; }

    .model-reset {
      font-size: 11px;
      color: #888;
      padding: 2px 8px;
      background: #f5f5f5;
      border-radius: 4px;
    }

    .error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      color: #dc2626;
      font-size: 14px;
    }

    .empty {
      text-align: center;
      padding: 60px 20px;
      color: #888;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .empty-title {
      font-size: 16px;
      font-weight: 500;
      color: #555;
    }

    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }

    .footer-time {
      font-size: 12px;
      color: #64748b;
    }

    .footer-link {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: linear-gradient(135deg, #fff 0%, #f0f7ff 100%);
      border: 1px solid #c7d2fe;
      color: #6366f1;
      text-decoration: none;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(99,102,241,0.1);
    }

    .footer-link:hover {
      transform: translateY(-3px);
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-color: #6366f1;
      color: #fff;
      box-shadow: 0 8px 24px rgba(99,102,241,0.3);
    }

    .footer-link svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="brand">
        <div class="brand-logo">
          <img src="${iconUri}" alt="logo">
        </div>
        <div>
          <div class="brand-title">AG Token</div>
          <div class="brand-subtitle">Antigravity AI 配额监控</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn" id="refreshBtn" onclick="refresh()">
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span>刷新</span>
        </button>
        <button class="btn icon-btn" onclick="openSettings()" title="设置">
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>

    <div id="error" class="error hidden"></div>
    <div id="stats" class="stats"></div>
    <div id="groups"></div>
    <div id="empty" class="empty hidden">
      <div class="empty-icon">📊</div>
      <div class="empty-title">暂无配额数据</div>
    </div>

    <footer class="footer">
      <span id="time" class="footer-time"></span>
      <a href="https://github.com/changingshow/AG-Token" target="_blank" class="footer-link" title="GitHub">
        <svg viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
      </a>
    </footer>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const warningThreshold = ${warningThreshold};
    const criticalThreshold = ${criticalThreshold};
    
    let isLoading = false;
    const refreshBtn = document.getElementById('refreshBtn');
    const errorEl = document.getElementById('error');
    const statsEl = document.getElementById('stats');
    const groupsEl = document.getElementById('groups');
    const emptyEl = document.getElementById('empty');
    const timeEl = document.getElementById('time');

    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.command === 'updateQuota') {
        renderData(msg.data);
        setLoading(false);
      } else if (msg.command === 'setLoading') {
        setLoading(msg.loading);
      }
    });

    renderData(${JSON.stringify(this._quotaData)});

    function refresh() {
      if (isLoading) return;
      setLoading(true);
      vscode.postMessage({ command: 'refresh' });
    }

    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }

    function setLoading(v) {
      isLoading = v;
      refreshBtn.disabled = v;
      refreshBtn.classList.toggle('loading', v);
    }

    function getType(pct) {
      if (pct <= criticalThreshold) return 'critical';
      if (pct <= warningThreshold) return 'warning';
      return 'success';
    }

    function getGroupIcon(id) {
      if (id.includes('ANTHROPIC')) return ['claude', 'A'];
      if (id.includes('GOOGLE')) return ['gemini', 'G'];
      if (id.includes('OPENAI')) return ['openai', 'O'];
      return ['other', '?'];
    }

    function toggleGroup(el) {
      el.closest('.group').classList.toggle('open');
    }

    function renderData(data) {
      if (data.error) {
        errorEl.textContent = data.error;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.classList.add('hidden');
      }

      const groups = data.groups || [];
      const totalModels = groups.reduce((a, g) => a + g.items.length, 0);

      if (groups.length === 0) {
        statsEl.innerHTML = '';
        groupsEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
        return;
      }

      emptyEl.classList.add('hidden');

      const lowestPct = Math.min(...groups.map(g => g.percentage));
      const avgPct = Math.round(groups.reduce((a, g) => a + g.percentage, 0) / groups.length);
      const lowestType = getType(lowestPct);

      statsEl.innerHTML = \`
        <div class="stat-card">
          <div class="stat-value \${lowestType}">\${lowestPct}%</div>
          <div class="stat-label">最低配额</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${avgPct}%</div>
          <div class="stat-label">平均配额</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${totalModels}</div>
          <div class="stat-label">模型总数</div>
        </div>
      \`;

      groupsEl.innerHTML = groups.map((g, i) => {
        const type = getType(g.percentage);
        const [iconClass, iconText] = getGroupIcon(g.id);

        const modelsHtml = g.items.map(m => {
          const mType = getType(m.percentage);
          return \`
            <div class="model">
              <div class="model-status \${mType}"></div>
              <div class="model-info">
                <div class="model-name">\${m.displayName}</div>
                <div class="model-id">\${m.modelId}</div>
              </div>
              <span class="model-percent \${mType}">\${m.percentage}%</span>
              \${m.resetCountdown ? \`<span class="model-reset">\${m.resetCountdown}</span>\` : ''}
            </div>
          \`;
        }).join('');

        return \`
          <div class="group">
            <div class="group-header" onclick="toggleGroup(this)">
              <div class="group-icon \${iconClass}">\${iconText}</div>
              <div class="group-info">
                <div class="group-name">\${g.displayName}</div>
                <div class="group-meta">\${g.items.length} 个模型 · \${g.resetCountdown || '无限制'}</div>
              </div>
              <span class="group-percent \${type}">\${g.percentage}%</span>
              <div class="group-arrow">▼</div>
            </div>
            <div class="models">
              <div class="models-inner">\${modelsHtml}</div>
            </div>
          </div>
        \`;
      }).join('');

      if (data.lastUpdated) {
        timeEl.textContent = '更新于 ' + new Date(data.lastUpdated).toLocaleString('zh-CN');
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
