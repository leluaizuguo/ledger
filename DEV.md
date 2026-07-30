# 记账 — 开发文档

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
| 部署 | GitHub Pages (gh-pages 分支) |

## 项目结构

```
src/
├── App.tsx              # 路由配置
├── main.tsx             # 入口
├── index.css            # Tailwind + 暗色模式
├── vite-env.d.ts        # 类型声明 + __APP_VERSION__
├── types/
│   └── index.ts         # Bill, Account, Category, Template, RecurringBill 等
├── db/
│   └── index.ts         # Dexie schema v3 + 所有 CRUD 函数
├── store/
│   └── useStore.ts      # Zustand 全局状态
├── data/
│   └── categories.ts    # 预设分类 (12 支出 + 5 收入)
├── utils/
│   ├── format.ts        # 金额/日期格式化
│   ├── export.ts        # JSON/CSV 导出导入
│   ├── voice.ts         # 语音文本解析 (金额+分类+多笔拆分+中文数字)
│   └── volcengine.ts    # 语音入口 (recordAndRecognize)
├── components/
│   ├── Layout.tsx        # 底部导航 + 摇一摇 + 暗色 + URL 参数处理
│   ├── AmountInput.tsx   # 计算器键盘
│   ├── CategoryGrid.tsx  # 分类网格
│   └── BillItem.tsx      # 账单行 (长按/退款/删除)
└── pages/
    ├── RecordPage.tsx    # 记账 (组合付款/拍照/定位/报销)
    ├── BillsPage.tsx     # 账单列表 (搜索/批量/文本导入)
    ├── ChartPage.tsx     # 图表 (饼图/趋势/预算)
    ├── CalendarPage.tsx  # 收支日历
    └── AccountPage.tsx   # 资产 (账户/周期/模板/分期/存钱)
```

## 数据库 Schema (Dexie v3)

```typescript
bills: '++id, type, categoryId, accountId, date, amount, createdAt, isReimbursable, reimbursed, installmentId'
accounts: 'id, type'
budgets: '++id, month, categoryId'
templates: '++id, type'
recurrings: '++id, active'
installments: '++id, billId'
```

- **金额存储**: 整数分（fen），显示时 /100 转元
- **日期格式**: ISO 字符串 "2026-07-28"

## 版本号

`package.json` → `version` 字段 → `vite.config.ts` 的 `define` 注入 `__APP_VERSION__` → Layout 底部显示。

每次迭代改 `package.json` 的 `version` 即可，build 自动带入。

## 开发命令

```bash
cd D:\ledger
npm install          # 依赖 (国内用 npmmirror，比代理快)
npm run dev          # 开发服务器 localhost:5173
npx tsc --noEmit    # 类型检查
npm run build        # 构建到 dist/
npm run deploy       # 部署到 GitHub Pages
```

## 已尝试但放弃的方案

### 火山引擎豆包语音识别
- 原因：豆包语音只有 WebSocket 协议，鉴权需要自定义 HTTP header
- 浏览器 WebSocket API 不支持自定义 header（W3C 规范限制，非 PWA 限制）
- 尝试过 URL Query 传参、hf-mirror 等均不可行

### transformers.js / Whisper
- 原因：模型 150MB，HuggingFace 国内被墙，hf-mirror 跳回 HF
- 手机 PWA 无法走代理下载模型

### sherpa-onnx
- 原因：WASM demo 入口全部失效(HF 删了/ModelScope 挂了)
- 模型文件 30MB+ 且入口难找

## 迭代注意事项

1. **DB 迁移**: 用 Dexie `version(n).stores().upgrade()` 模式，不要直接改 schema
2. **金额**: 所有内部计算用分（fen），仅显示时 /100
3. **暗色模式**: 新组件加 `dark:` 前缀，主要用 `dark:bg-gray-900`, `dark:text-gray-200`, `dark:border-gray-800`
4. **语音解析**: 核心在 `voice.ts` 的 `AMOUNT_RE` 正则和 `KEYWORD_CATEGORY_MAP`
5. **API Key 安全**: 不要硬编码任何 key，已清理过一次 git 历史

## 部署

- `npm run deploy` → 推 `dist/` 到 `gh-pages` 分支
- GitHub Pages 自动从 `gh-pages` 分支 serve
- 如遇 SSL 错误重试即可（代理问题）
- 如遇 push protection，去 GitHub 点 Allow
