# 记账 — 开发文档 v0.11.1

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 |
| CSS | Tailwind CSS 4 |
| 路由 | React Router (HashRouter) |
| 数据库 | Dexie.js (IndexedDB 封装) |
| 状态管理 | Zustand |
| 图表 | Recharts |
| 语音识别 | Web Speech API (Edge → Azure 中国) |
| PWA | vite-plugin-pwa |
| 后端 | FastAPI + SQLite + Cloudflare Tunnel |
| 部署 | GitHub Pages (gh-pages 分支) |

## 项目结构

```
src/
├── App.tsx              # 路由配置（本地模式默认无需登录）
├── main.tsx             # 入口
├── index.css            # Tailwind + 暗色模式
├── vite-env.d.ts        # 类型声明 + __APP_VERSION__
├── types/
│   └── index.ts         # Bill, Account, Category, Template, RecurringBill 等
├── db/
│   └── index.ts         # Dexie schema v5 + 所有 CRUD 函数（含 updateBill）
├── store/
│   └── useStore.ts      # Zustand 全局状态 + updateBillRecord + 按日期排序
├── data/
│   └── categories.ts    # 预设分类 (12 支出 + 5 收入)
├── utils/
│   ├── format.ts        # 金额/日期格式化
│   ├── export.ts        # JSON/CSV 导出导入
│   ├── voice.ts         # 语音文本解析 (金额+分类+多笔拆分+中文数字)
│   ├── volcengine.ts    # 语音入口 (recordAndRecognize)
│   ├── api.ts           # 同步 API 客户端 (runtime 可配置服务器地址)
│   └── sync.ts          # 同步引擎 (push/pull, 3s 间隔, 竞态保护)
├── components/
│   ├── Layout.tsx        # 底部导航 + 摇一摇 + 暗色 + 登录/同步状态 + 版本号
│   ├── AmountInput.tsx   # 计算器键盘
│   ├── CategoryGrid.tsx  # 分类网格
│   └── BillItem.tsx      # 账单行 (长按 800ms/修改弹窗/删除)
└── pages/
    ├── RecordPage.tsx    # 记账 (组合付款/拍照/定位/报销)
    ├── BillsPage.tsx     # 账单列表 (搜索/批量/文本导入)
    ├── ChartPage.tsx     # 图表 (饼图/趋势/预算)
    ├── CalendarPage.tsx  # 收支日历
    ├── AccountPage.tsx   # 资产 (账户/周期/模板/分期/存钱/同步配置)
    └── LoginPage.tsx     # 登录/注册（可选，用于同步功能）
```

## 架构设计

### 本地模式（默认）

- 打开即用，不需要登录
- 数据全存浏览器 IndexedDB (Dexie.js)
- 顶部显示「本地模式」，右侧「登录同步」按钮

### 同步模式（可选）

- 用户主动登录后启动同步引擎
- 登录态存 localStorage (JWT token)
- 服务器地址通过「资产 → 同步」tab 配置，存 localStorage
- 同步间隔 3 秒，全量 push + pull
- **竞态保护**：push 开始时记录时间戳，pull 后删除本地多余账单时跳过 push 之后新增的记录

## 数据库 Schema (Dexie v6)

```typescript
bills: '++id, type, categoryId, accountId, date, amount, createdAt, updatedAt, client_id, user_id'
accounts: 'id, type'
budgets: '++id, month, categoryId'
templates: '++id, type'
recurrings: '++id, active'
installments: '++id, billId'
custom_cats: 'id, type'
foreign_bills: 'client_id, date, user_id, createdAt'   // 圈子他人账单缓存，只读，永不参与 push
```

- **金额存储**: 整数分（fen），显示时 /100 转元
- **日期格式**: ISO 字符串 "2026-07-28"
- **client_id**: 本地生成 UUID，用于跨设备去重
- **updatedAt**: Unix 时间戳（秒），每次修改/同步更新，用于冲突检测和竞态保护
- **createdAt**: Unix 时间戳（毫秒），服务端同步现在返回 `created_at` 用于正确排序
- **foreign_bills**: 圈子内其他成员的账单缓存。独立表，主键 client_id。pull 成功后整体替换（`replaceForeignBills`），启动时先读它填 UI，因此**离线/服务器断掉也能看到圈子账单**。退圈/换圈/登出时清空。

服务端 SQLite 表：
```sql
bills: id, client_id, user_id, group_id, amount, type, category_id, account_id,
       note, date, created_at, updated_at, deleted_at (软删除)
users: id, username, display_name, password_hash, group_id
groups: id, name, invite_code, created_by, is_shared
```

## 版本号

`package.json` → `version` 字段 → `vite.config.ts` 的 `define` 注入 `__APP_VERSION__` → Layout 底部显示。

**必须用 `npm run build`**，不能用 `npx vite build`！版本号通过 `npm_package_version` 环境变量注入，直接调 vite 拿不到。

## 开发命令

```bash
cd D:\ledger
npm install          # 依赖 (国内用 npmmirror，比代理快)
npm run dev          # 开发服务器 localhost:5173
npx tsc --noEmit    # 类型检查
npm run build        # 构建到 dist/ （必须用 npm run，不能用 npx vite）
npm run deploy       # 部署到 GitHub Pages
```

## PWA 自动更新

- `vite.config.ts` 的 `workbox.additionalManifestEntries` 注入 `Date.now()` 作为 revision
- 每次构建 SW 内容不同 → 浏览器检测到新 SW → 自动 skipWaiting 激活
- 用户无需手动刷新

## 版本历史

| 版本 | 更新 |
|------|------|
| v0.11.1 | 修复顶部同步状态不显示「离线」：syncStatus=offline 时圆点转橙色、文字显示离线（原来 idle/offline 都显示在线） |
| v0.11.0 | 圈子账单离线可见：他人账单落 IndexedDB（Dexie v6 新增 foreign_bills 表），启动时先读缓存再联网；同步过一次后断网/服务器宕机也能看到全部账单 |
| v0.10.0 | 图表分析新增查看范围筛选：整体/我/圈子各成员，结余/趋势/饼图/排行按人统计，预算保持家庭口径 |
| v0.9.2 | 修复长按修改后偶发回退：saveRemote 合并不再用旧远端数据覆盖更新过的本地（同步竞态） |
| v0.9.1 | 账单按日期整体排序（自己/他人混排）；服务端返回 created_at 修复排序 |
| v0.9.0 | 长按「修改」替换「退款」：弹窗编辑金额/分类/账户/备注/日期 |
| v0.8.7 | SW 每次构建加唯一时间戳，PWA 自动检测更新 |
| v0.8.6 | 修复同步竞态：push/pull 之间新增账单不再被误删 |
| v0.8.5 | 长按改为 800ms + 移动/离开取消，防止误触 |
| v0.7.4 | 本地优先模式：默认无需登录，同步功能变为可选 |
| v0.7.3 | 服务器地址运行时配置 |
| v0.7.2 | 圈子隔离（邀请码机制） |
| v0.7.1 | 多设备同步 |
| v0.7.0 | 后端服务 + Cloudflare Tunnel |
| v0.6.5 | 本地完整功能（分类/模板/周期/分期/存钱/语音） |

## 已尝试但放弃的方案

### 火山引擎豆包语音识别
- 原因：豆包语音只有 WebSocket 协议，鉴权需要自定义 HTTP header
- 浏览器 WebSocket API 不支持自定义 header（W3C 规范限制）

### transformers.js / Whisper
- 原因：模型 150MB，HuggingFace 国内被墙

### sherpa-onnx
- 原因：WASM demo 入口全部失效(HF 删了/ModelScope 挂了)

## 迭代注意事项

1. **DB 迁移**: 用 Dexie `version(n).stores().upgrade()` 模式，不要直接改 schema
2. **金额**: 所有内部计算用分（fen），仅显示时 /100
3. **暗色模式**: 新组件加 `dark:` 前缀，主要用 `dark:bg-gray-900`, `dark:text-gray-200`, `dark:border-gray-800`
4. **语音解析**: 核心在 `voice.ts` 的 `AMOUNT_RE` 正则和 `KEYWORD_CATEGORY_MAP`
5. **API Key 安全**: 不要硬编码任何 key
6. **本地优先**: 新功能默认不依赖登录，同步功能通过 isLoggedIn() 守卫
7. **构建命令**: 永远用 `npm run build`，不要用 `npx vite build`——版本号依赖 npm_package_version 环境变量
8. **updateBill**: 修改账单时先冲销旧余额影响，再应用新余额，两个步骤在同一函数内完成
9. **同步竞态**: 新增/修改账单时确保 `updatedAt` 正确设置，sync.ts 用 pushStartTime 保护新增账单

## 部署

- `npm run deploy` → 推 `dist/` 到 `gh-pages` 分支
- GitHub Pages 自动从 `gh-pages` 分支 serve
- 如遇 SSL 错误重试即可（代理问题）
- 如遇 push protection，去 GitHub 点 Allow
- 服务端修改后需重启 uvicorn 进程
