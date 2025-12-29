# AG Token

实时查看 Antigravity AI 模型用量和余额的 VSCode 扩展。

## ✨ 功能

- 📊 **状态栏显示**: 实时在状态栏显示最低配额模型的使用情况
- 🎨 **颜色编码**: 绿色（充足）、黄色（警告）、红色（紧急）
- 📋 **详情面板**: 点击状态栏查看所有模型的详细配额信息
- 🔄 **自动刷新**: 可配置的自动刷新间隔
- 🔔 **低配额通知**: 配额低于阈值时发送通知

## 📦 安装

### 从 Open VSX 安装
1. 打开 Antigravity IDE
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 "AG Token"
4. 点击安装

### 从 VSIX 安装
1. 下载 `.vsix` 文件
2. 在 Antigravity IDE 中按 `Ctrl+Shift+P`
3. 输入 "Install from VSIX"
4. 选择下载的文件

## 🚀 使用

### 快捷键
- `Ctrl+Shift+R` / `Cmd+Shift+R`: 刷新配额（面板打开时）

### 命令
- `AG Token: 查看配额详情`: 打开详情面板 (亦可点击状态栏)
- `AG Token: 刷新配额`: 手动刷新配额数据

## ⚙️ 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `agToken.autoRefresh` | false | 是否启用自动刷新 |
| `agToken.refreshInterval` | 5 | 自动刷新间隔（分钟） |
| `agToken.warningThreshold` | 30 | 警告阈值（%） |
| `agToken.criticalThreshold` | 10 | 紧急阈值（%） |
| `agToken.statusBarFormat` | "full" | 状态栏显示格式 |
| `agToken.enableNotifications` | true | 启用低配额通知 |
| `agToken.trackedModels` | [...] | 要追踪的模型列表 |

### 状态栏格式选项
- `emoji`: 仅显示颜色图标
- `percentage`: 显示百分比
- `model`: 显示模型名和图标
- `full`: 显示完整信息

## 🔧 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 打包
npm run package
```

按 `F5` 启动调试。

## 📝 更新日志

### 0.1.0
- 初始版本
- 状态栏配额显示
- Webview 详情面板
- 自动刷新
- 低配额通知

## 📄 许可证

MIT
