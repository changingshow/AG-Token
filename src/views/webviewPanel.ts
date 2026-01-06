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
            // 打开 GitHub 主页
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/changingshow/AG-Token'));
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
  <title>AG Token 仪表盘</title>
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-editorWidget-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-widget-border);
      --accent-color: var(--vscode-textLink-foreground);
      --hover-bg: var(--vscode-list-hoverBackground);
      
      --color-success: #3fb950;
      --color-warning: #d29922;
      --color-error: #f85149;
      
      --radius-lg: 12px;
      --radius-md: 8px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      background-color: var(--bg-primary);
      color: var(--text-primary);
      padding: 0;
      height: 100vh;
      overflow: hidden; /* Prevent body scroll, use .content instead */
    }

    /* Flex Layout Structure */
    .layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-width: 900px;
        margin: 0 auto;
        border-left: 1px solid transparent; 
        border-right: 1px solid transparent;
    }
    /* Optional: Add borders if window is very wide? No, cleaner without. */
    
    /* Header - Fixed at top */
    .header {
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 32px 24px 24px;
      border-bottom: 1px solid var(--border-color);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); /* Subtle shadow for depth */
      background: var(--bg-primary); 
      z-index: 10;
    }
    .header-branding {
        display: flex;
        align-items: center;
        gap: 16px;
    }
    .app-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .header h1 {
      font-size: 24px;
      font-weight: 500;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }
    .header-actions {
      display: flex;
      gap: 12px;
    }
    .btn {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 6px 12px;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn:hover { background: var(--hover-bg); }
    .btn svg { width: 14px; height: 14px; fill: currentColor; }
    .btn.loading svg { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .icon-btn {
      padding: 6px;
      width: 32px;
      height: 32px;
      justify-content: center;
    }

    /* Content Area - Scrollable */
    .content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        /* Scrollbar styling for Webkit */
        scrollbar-width: thin;
        scrollbar-color: var(--vscode-scrollbarSlider-background) transparent;
    }
    .content::-webkit-scrollbar { width: 10px; }
    .content::-webkit-scrollbar-thumb {
        background-color: var(--vscode-scrollbarSlider-background);
        border-radius: 5px;
        border: 2px solid var(--bg-primary);
    }
    .content::-webkit-scrollbar-track { background: transparent; }

    /* Footer - Fixed at bottom */
    .footer {
        flex-shrink: 0;
        padding: 16px 24px;
        border-top: 1px solid var(--border-color);
        box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.05); /* Subtle shadow for depth */
        background: var(--bg-primary);
        text-align: center;
        z-index: 10;
    }
    .github-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 12px;
        padding: 6px 12px;
        border-radius: 20px;
        transition: all 0.2s;
        cursor: pointer;
    }
    .github-link:hover {
        background: var(--hover-bg);
        color: var(--text-primary);
    }
    .github-link svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
    }

    /* Grid Layout */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    /* Quota Card */
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      border-color: var(--accent-color);
    }

    .card-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .card-title {
      font-weight: 600;
      font-size: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .reset-badge {
      font-size: 11px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    /* Ring Chart */
    .ring-container {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: conic-gradient(
        var(--ring-color, var(--color-success)) var(--progress, 0%), 
        var(--vscode-widget-shadow) 0
      );
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      position: relative;
    }
    .ring-inner {
      width: 86px;
      height: 86px;
      background: var(--bg-secondary);
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }
    .ring-percent {
      font-size: 20px;
      font-weight: 700;
      font-family: 'SF Mono', Consolas, monospace;
    }
    .ring-label {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    /* Grouped Section (Accordion) */
    .group-section {
        margin-bottom: 16px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        overflow: hidden;
    }
    .group-header {
        padding: 12px 16px;
        background: rgba(128,128,128,0.03);
        border-bottom: 1px solid transparent; 
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        transition: background 0.2s;
    }
    .group-header:hover {
        background: var(--hover-bg);
    }
    .group-header-left, .group-header-right {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .chevron {
        font-size: 10px;
        color: var(--text-secondary);
        transition: transform 0.2s ease;
        display: inline-block;
        width: 16px;
        text-align: center;
    }
    .group-section.expanded .chevron {
        transform: rotate(90deg);
    }
    /* Removed border-bottom-color change to avoid "black line" */
    .group-content {
        display: none;
        background: var(--bg-primary);
    }
    .group-section.expanded .group-content {
        display: block;
        animation: slideDown 0.2s ease-out;
    }
    
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .group-reset {
        font-family: monospace;
        font-size: 11px;
        color: var(--text-secondary);
        background: var(--bg-primary); /* subtle contrast */
        padding: 2px 6px;
        border-radius: 4px;
    }

    .model-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 32px 10px 40px; /* Indent to align with title */
      border-bottom: 1px solid var(--border-color);
      font-size: 13px;
    }
    .model-row:last-child { border-bottom: none; }
    .model-name { font-weight: 500; display:flex; flex-direction:column; gap:2px; }
    .model-id { font-size: 11px; color: var(--text-secondary); opacity: 0.8; }
    .model-meta { font-family: monospace; color: var(--text-secondary); display:flex; align-items:center;}

    .empty-state {
      text-align: center;
      padding: 60px;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="layout">
    <header class="header">
      <div class="header-branding">
        <img src="${iconUri}" class="app-icon" alt="AG" />
        <div>
            <h1>仪表盘</h1>
            <p style="color: var(--text-secondary); font-size: 13px;">Antigravity 配额监控</p>
        </div>
      </div>
      <div class="header-actions">
        <!-- Refresh Button -->
        <button class="btn" id="refreshBtn" onclick="refresh()">
          <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-0.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14 0.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
          刷新
        </button>
        <!-- Settings Button -->
        <button class="btn icon-btn" onclick="openSettings()" title="打开设置">
           <svg viewBox="0 0 24 24"><path d="M12.2 2H11.8C6.93 2.01 2.99 6.2 3.28 11.23C3.51 15.22 8.76 21.05 11.33 21.84C11.75 21.97 12.24 21.97 12.67 21.84C15.23 21.05 20.49 15.22 20.72 11.23C21.01 6.2 17.07 2.01 12.2 2ZM12 14.5C10.62 14.5 9.5 13.38 9.5 12C9.5 10.62 10.62 9.5 12 9.5C13.38 9.5 14.5 10.62 14.5 12C14.5 13.38 13.38 14.5 12 14.5Z"/></svg>
        </button>
      </div>
    </header>

    <main class="content">
        <!-- Overview Grid (Pie Charts) -->
        <div id="grid" class="grid"></div>

        <!-- Grouped Detail Lists -->
        <div id="details"></div>
    </main>
    
    <footer class="footer">
        <a class="github-link" onclick="openGithub()">
            <svg viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
            Github 项目地址
        </a>
    </footer>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const warning = ${warningThreshold};
    const critical = ${criticalThreshold};

    // Update gear icon
    const gearPath = "M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z";
    document.querySelector('.icon-btn svg path').setAttribute('d', gearPath);

    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.command === 'updateQuota') render(msg.data);
      if (msg.command === 'setLoading') toggleLoading(msg.loading);
    });

    try {
        render(${JSON.stringify(this._quotaData)});
    } catch (e) { console.error(e); }

    function refresh() {
      toggleLoading(true);
      vscode.postMessage({ command: 'refresh' });
    }
    
    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }

    function openGithub() {
        vscode.postMessage({ command: 'openGithub' });
    }

    function toggleGroup(header) {
        header.parentElement.classList.toggle('expanded');
    }

    function toggleLoading(isLoading) {
      const btn = document.getElementById('refreshBtn');
      if (!btn) return;
      if(isLoading) btn.classList.add('loading');
      else btn.classList.remove('loading');
    }

    function getColor(pct) {
      if(pct < critical) return 'var(--color-error)';
      if(pct < warning) return 'var(--color-warning)';
      return 'var(--color-success)';
    }

    function render(data) {
      const grid = document.getElementById('grid');
      const details = document.getElementById('details');
      
      if (!data || !data.groups || data.groups.length === 0) {
        grid.innerHTML = '<div class="empty-state">暂无配额数据。</div>';
        details.innerHTML = '';
        return;
      }

      // Render Overview Cards (Groups)
      grid.innerHTML = data.groups.map(g => {
        const color = getColor(g.percentage);
        const resetText = g.resetCountdown ? g.resetCountdown : '无限制';
        
        return \`
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                \${g.displayName}
              </span>
              <span class="reset-badge">\${resetText}</span>
            </div>
            <div class="ring-container" style="--progress: \${g.percentage}%; --ring-color: \${color};">
              <div class="ring-inner">
                <div class="ring-percent" style="color: \${color}">\${g.percentage}%</div>
                <div class="ring-label">Tokens</div>
              </div>
            </div>
          </div>
        \`;
      }).join('');

      // Render Details (Collapsible Groups)
      details.innerHTML = data.groups.map(g => {
        const color = getColor(g.percentage);
        const resetText = g.resetCountdown || '';
        
        const rows = g.items.map(m => {
            const mColor = getColor(m.percentage);
            return \`
              <div class="model-row">
                <div class="model-name">
                    <span>\${m.displayName}</span>
                    <span class="model-id">\${m.name}</span>
                </div>
                <div class="model-meta">
                   <span style="color:\${mColor}; font-weight:bold; margin-right:8px">\${m.percentage}%</span>
                   \${m.resetCountdown || ''}
                </div>
              </div>
            \`;
        }).join('');

        // Note: Default collapsed (no 'expanded' class)
        return \`
            <div class="group-section">
                <div class="group-header" onclick="toggleGroup(this)">
                    <div class="group-header-left">
                        <span class="chevron">▶</span>
                        <span class="group-title">\${g.displayName}</span>
                    </div>
                    <div class="group-header-right">
                         <span style="color:\${color}; font-weight:bold;">\${g.percentage}%</span>
                         \${resetText ? \`<span class="group-reset">\${resetText}</span>\` : ''}
                    </div>
                </div>
                <div class="group-content">
                    \${rows}
                </div>
            </div>
        \`;
      }).join('');
      
      toggleLoading(false);
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
