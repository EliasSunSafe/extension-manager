# 扩展管理器（Extension Manager）

一个基于 **Manifest V3** 的浏览器扩展，用于在一个弹窗里**快速开关其它浏览器扩展、直达它们的设置页**，并支持**单列 / 双列**视图与**详细 / 仅图标**两种显示密度的自由组合。

> 兼容 Chrome / Edge 及绝大多数 Chromium 内核浏览器（使用 `chrome.management` + `chrome.storage` API）。

---

## 1. 核心功能

| 功能 | 说明 |
| --- | --- |
| 一键开关 | 列表内每个扩展带一个开关（Switch），点击立即 `setEnabled` 启用 / 禁用 |
| 直达设置 | 齿轮按钮直接打开该扩展的 `optionsUrl`（选项页），无需再进 `chrome://extensions` 逐项点开 |
| 单列 / 双列 | 顶部分段控件一键切换列表为单列（每行一个）或双列（每行两个） |
| 详细 / 仅图标 | 「详细」显示图标 + 名称 + 简要描述；「图标」仅显示图标，名称以 tooltip 提示 |
| 搜索 | 按名称或描述实时过滤 |
| 类型筛选 | 全部 / 扩展 / 主题 / 应用 |
| 偏好记忆 | 列数、密度、筛选、搜索词保存到 `chrome.storage.sync`，跨设备同步 |
| 实时刷新 | 监听 `onEnabled / onDisabled / onInstalled / onUninstalled`，列表自动更新 |
| 启用置顶 | 已启用的扩展自动排在列表前面，禁用的靠后，各组内仍按名称排序 |
| 策略保护 | `mayDisable === false` 的项目（企业策略 / 系统组件）开关置灰，避免误操作报错 |
| 深色模式 | 跟随系统 `prefers-color-scheme` |

### 四种视图组合

| 列数 ↓ \ 密度 → | 详细 | 仅图标 |
| --- | --- | --- |
| **单列** | 每行一个卡片：图标 + 名称 + 描述 + 设置 + 开关 | 每行一个卡片：仅图标 + 开关（名称悬浮提示） |
| **双列** | 每行两个卡片，信息密度高 | 每行两个图标，最紧凑的「图标墙」 |

---

## 2. 技术方案

- **平台**：Chromium 扩展，Manifest V3（Service Worker 无后台常驻页，本扩展只使用 `action.default_popup`，无需 background）。
- **数据来源**：`chrome.management.getAll()` 返回 `ExtensionInfo[]`，含 `id / name / description / icons / enabled / mayDisable / optionsUrl / type / disabledReason` 等字段。
- **开关**：`chrome.management.setEnabled(id, enabled)`，回调里通过 `chrome.runtime.lastError` 捕获失败（如策略限制）。
- **设置页**：`chrome.tabs.create({ url: ext.optionsUrl })`（`tabs.create` 无需 `tabs` 权限）。
- **应用启动**：`chrome.management.launchApp(id)`（对 App 类型显示「启动」按钮，替换开关）。
- **偏好存储**：`chrome.storage.sync` 存视图偏好。
- **界面**：纯 HTML/CSS/原生 JS，无构建步骤、无第三方依赖。

### 权限说明

```json
"permissions": ["management", "storage"]
```

- `management`：读取并开关其它扩展（安装时会显示「管理您的应用、扩展程序和主题」提示，这是实现本功能所必需）。
- `storage`：保存视图偏好。

---

## 3. 文件结构

```
extension-manager/
├── manifest.json        # MV3 清单与权限
├── popup.html           # 弹窗结构（头部控件 + 列表 + 底栏）
├── popup.css            # 布局、四种视图、开关/深色模式样式
├── popup.js             # 数据获取、渲染、开关、偏好存储
├── generate_icons.py    # 用 Pillow 生成图标（可删除）
└── icons/               # 生成的 icon16/48/128.png
```

---

## 4. 安装（本地加载）

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）。
2. 右上角开启「开发者模式」。
3. 点「加载已解压的扩展程序」，选择本 `extension-manager` 目录。
4. 点击工具栏上的扩展图标即可打开弹窗。

---

## 5. 实现要点

- **排除自身**：`refresh()` 中 `filter(e => e.id !== chrome.runtime.id)`，避免「管理自己的开关」导致无法禁用自身的死循环体验。
- **图标回退**：`pickIcon()` 优先取 48px 图标；无图标或加载失败时，用名称首字母生成彩色占位块。
- **失败回滚**：`setEnabled` 失败时 toast 提示并 `refresh()` 还原开关状态。
- **纯 CSS 切视图**：列数与密度只切换 `list` 的 class（`single/double/icon-only`），无需重建 DOM，切换即时。
- **启用置顶**：`compareExtensions()` 先按 `enabled` 降序、再按名称排序，实现启用项自动置顶（禁用项沉底）。

---

## 6. 限制与已知边界

- 无法读取或修改其它扩展的**内部设置值**（浏览器不开放该 API），只能通过 `optionsUrl` 打开其官方设置页。
- 企业策略强制安装 / 系统组件类项目（`mayDisable === false`）无法开关，UI 会置灰。
- 部分扩展未提供 `optionsUrl`（未使用 `options_ui` / `options_page`），此时不显示齿轮按钮。
- `management` 权限在安装时的警告文案较醒目，属该能力固有提示。

---

## 7. 后续可扩展方向

- 分组 / 收藏（置顶常用扩展）。
- 批量启用 / 禁用（一键关闭全部）。
- 导出当前启用状态为 JSON 快照并一键恢复。
- 键盘导航与快捷键（如全局快捷键开关弹窗）。
- 状态统计页（启用率、最近变更时间线）。
