# AG Token

实时查看 Antigravity AI 模型用量和余额的 VSCode 扩展。

## ⚠️ 前提条件

**此扩展需要 [Antigravity IDE](https://www.antigravity.dev/) 已安装并登录。**

本扩展通过读取 Antigravity IDE 本地存储的登录凭据来查询配额信息，不会收集或上传任何用户数据。

## ✨ 功能

- 📊 **状态栏显示**: 实时在状态栏显示各模型组的配额使用情况
- 🎨 **颜色编码**: 绿色（充足）、黄色（警告）、红色（紧急）
- 📋 **详情面板**: 点击状态栏查看所有模型的详细配额信息
- 🔄 **自动刷新**: 可配置的自动刷新间隔
- 🔔 **低配额通知**: 配额低于阈值时发送通知

## 🔒 隐私说明

- 本扩展**仅在本地运行**，不收集任何用户数据
- Token 刷新通过 Google OAuth 官方 API 进行
- 配额查询通过 Google Cloud Code API 进行
- 所有数据仅用于本地显示，不会发送到任何第三方服务器

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

### 状态栏格式选项
- `emoji`: 仅显示颜色图标
- `percentage`: 显示百分比
- `model`: 显示模型名和图标
- `full`: 显示完整信息

## 🔧 开发

### 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/changingshow/AG-Token.git
cd AG-Token

# 2. 安装依赖
npm install
```

### 开发模式

```bash
# 编译（单次）
npm run compile

# 监听模式（修改代码后自动编译）
npm run watch
```

然后按 `F5` 启动调试，会打开一个新的 VS Code 窗口加载扩展。

### 打包发布

```bash
# 生产环境打包
npm run package

# 生成 .vsix 安装包
npx @vscode/vsce package
```

打包成功后会在项目根目录生成 `ag-token-x.x.x.vsix` 文件。

## 📝 更新日志

### 0.1.0
- 初始版本
- 状态栏配额显示（按模型组：Claude/Gemini/OpenAI）
- Webview 详情面板
- 自动刷新
- 低配额通知

## 📄 许可证

MIT
