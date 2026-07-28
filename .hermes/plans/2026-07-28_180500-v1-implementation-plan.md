# V1 — 核心记账 MVP 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 一个可用的 PWA 记账应用：能记、能查、能分类、数据不丢

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Dexie.js + Zustand + Recharts + vite-plugin-pwa

**Architecture:** SPA 三 Tab 结构（记账 / 账单 / 图表），IndexedDB 本地存储，无后端

**UI 参考:** iCost 极简风格 — 底部三 Tab，大金额显示，分类网格，时间线账单

**工时估算:** ~35 个 task，每个 2-5 分钟，总计 2-3 小时

---

## 项目结构（最终态）

```
D:\ledger\
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── README.md
├── public/
│   ├── logo-192.png
│   └── logo-512.png
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── db/
    │   └── index.ts          # Dexie schema + CRUD helpers
    ├── store/
    │   └── useStore.ts       # Zustand global state
    ├── types/
    │   └── index.ts          # TypeScript 类型定义
    ├── components/
    │   ├── Layout.tsx         # 底部 Tab 导航壳
    │   ├── AmountInput.tsx    # 金额输入区
    │   ├── CategoryGrid.tsx   # 分类选择网格
    │   ├── BillItem.tsx       # 账单列表单项
    │   └── MonthSummary.tsx   # 月度概览卡片
    ├── pages/
    │   ├── RecordPage.tsx     # 记账页
    │   ├── BillsPage.tsx      # 账单列表页
    │   └── ChartPage.tsx      # 月度图表页
    └── utils/
        ├── format.ts          # 金额/日期格式化
        └── export.ts          # JSON 导出/导入
```

---

## Task 1: 脚手架 — Vite + React + TS + Tailwind

**Objective:** 创建项目骨架，跑通 dev server

**Files:**
- Create: `package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`

**Step 1: 创建项目**

```bash
cd /d/ledger
npm create vite@latest . -- --template react-ts
# Vite 会提示非空目录，选 Ignore files and continue
npm install
```

**Step 2: 安装 Tailwind**

```bash
npm install -D tailwindcss @tailwindcss/vite
```

**Step 3: 配置 vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**Step 4: 注入 Tailwind 到 src/index.css**

```css
@import "tailwindcss";
```

**Step 5: 清理 src/App.tsx 为 Hello World**

```tsx
function App() {
  return <div className="p-8 text-xl">记账</div>
}
export default App
```

**Step 6: 验证**

```bash
npm run dev
# 浏览器打开 http://localhost:5173，看到"记账"二字
```

**Step 7: 提交**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS + Tailwind"
```

---

## Task 2: 安装核心依赖

**Objective:** 安装 Dexie, Zustand, Recharts, react-router, vite-plugin-pwa

```bash
npm install dexie zustand recharts react-router-dom
npm install -D vite-plugin-pwa
```

**验证:**

```bash
npx tsc --noEmit   # 确保类型不出错
```

**提交:**

```bash
git add package.json package-lock.json && git commit -m "chore: add deps (dexie, zustand, recharts, router, pwa)"
```

---

## Task 3: 类型定义

**Objective:** 定义核心数据模型

**Create:** `src/types/index.ts`

```ts
// 账单记录
export interface Bill {
  id?: number            // Dexie 自增主键
  amount: number         // 金额（分，整数存储避免浮点）
  type: 'expense' | 'income'
  categoryId: string     // 分类 ID
  note: string           // 备注
  date: string           // ISO 日期 "2026-07-28"
  createdAt: number      // 时间戳
}

// 分类
export interface Category {
  id: string             // 如 'food', 'transport'
  name: string           // 如 '餐饮', '交通'
  icon: string           // emoji 图标 '🍔'
  type: 'expense' | 'income'
  parentId?: string      // 二级分类的父级 ID
}

// 月度统计
export interface MonthStats {
  totalExpense: number
  totalIncome: number
  balance: number
  categoryBreakdown: { categoryId: string; name: string; icon: string; amount: number; percent: number }[]
}
```

**提交:**

```bash
git add src/types/index.ts && git commit -m "feat: add Bill, Category, MonthStats types"
```

---

## Task 4: 预设分类数据

**Objective:** 定义 20+ 个内置支出/收入分类

**Create:** `src/data/categories.ts`

```ts
import { Category } from '../types'

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: 'food',      name: '餐饮',   icon: '🍔', type: 'expense' },
  { id: 'transport', name: '交通',   icon: '🚌', type: 'expense' },
  { id: 'shopping',  name: '购物',   icon: '🛒', type: 'expense' },
  { id: 'entertain', name: '娱乐',   icon: '🎮', type: 'expense' },
  { id: 'housing',   name: '住房',   icon: '🏠', type: 'expense' },
  { id: 'medical',   name: '医疗',   icon: '💊', type: 'expense' },
  { id: 'education', name: '教育',   icon: '📚', type: 'expense' },
  { id: 'digital',   name: '数码',   icon: '📱', type: 'expense' },
  { id: 'beauty',    name: '美容',   icon: '💄', type: 'expense' },
  { id: 'pet',       name: '宠物',   icon: '🐱', type: 'expense' },
  { id: 'gift',      name: '人情',   icon: '🎁', type: 'expense' },
  { id: 'other_exp', name: '其他支出', icon: '💸', type: 'expense' },
]

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: 'salary',    name: '工资',   icon: '💰', type: 'income' },
  { id: 'bonus',     name: '奖金',   icon: '🧧', type: 'income' },
  { id: 'invest',    name: '投资',   icon: '📈', type: 'income' },
  { id: 'parttime',  name: '兼职',   icon: '💼', type: 'income' },
  { id: 'other_inc', name: '其他收入', icon: '📥', type: 'income' },
]
```

**提交:**

```bash
git add src/data/categories.ts && git commit -m "feat: add default category presets (12 expense + 5 income)"
```

---

## Task 5: 金额格式化工具

**Objective:** 金额分↔元转换，日期格式化

**Create:** `src/utils/format.ts`

```ts
// 金额：内部用分存储，显示用元
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100)
}

// 格式化金额显示 ¥1,234.56
export function formatMoney(fen: number): string {
  const yuan = fen / 100
  return `¥${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// 格式化日期
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function getMonthKey(iso: string): string {
  return iso.slice(0, 7) // "2026-07"
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
```

**提交:**

```bash
git add src/utils/format.ts && git commit -m "feat: add money/date formatters"
```

---

## Task 6: Dexie 数据库 Schema

**Objective:** 定义 IndexedDB 表结构，包含增删改查方法

**Create:** `src/db/index.ts`

```ts
import Dexie, { Table } from 'dexie'
import { Bill } from '../types'

class LedgerDB extends Dexie {
  bills!: Table<Bill, number>

  constructor() {
    super('ledger')
    this.version(1).stores({
      bills: '++id, type, categoryId, date, amount, createdAt',
    })
  }
}

export const db = new LedgerDB()

// === CRUD Helpers ===

export async function addBill(bill: Omit<Bill, 'id' | 'createdAt'>): Promise<number> {
  return db.bills.add({ ...bill, createdAt: Date.now() })
}

export async function getBillsByMonth(monthKey: string): Promise<Bill[]> {
  return db.bills
    .where('date')
    .startsWith(monthKey)
    .reverse()
    .sortBy('createdAt')
}

export async function getBillsByCategory(categoryId: string, monthKey: string): Promise<Bill[]> {
  return db.bills
    .where('categoryId')
    .equals(categoryId)
    .filter(b => b.date.startsWith(monthKey))
    .toArray()
}

export async function deleteBill(id: number): Promise<void> {
  return db.bills.delete(id)
}

export async function updateBill(id: number, changes: Partial<Bill>): Promise<number> {
  return db.bills.update(id, changes)
}

export async function getAllBills(): Promise<Bill[]> {
  return db.bills.orderBy('createdAt').reverse().toArray()
}
```

**提交:**

```bash
git add src/db/index.ts && git commit -m "feat: add Dexie schema and CRUD helpers"
```

---

## Task 7: Zustand Store

**Objective:** 全局状态：当前月份、账单列表、刷新标记

**Create:** `src/store/useStore.ts`

```ts
import { create } from 'zustand'
import { Bill, MonthStats, Category } from '../types'
import { getCurrentMonth } from '../utils/format'
import { getBillsByMonth, addBill, deleteBill } from '../db'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../data/categories'

interface LedgerState {
  // 当前选中月份
  currentMonth: string
  setCurrentMonth: (month: string) => void

  // 账单
  bills: Bill[]
  loadBills: () => Promise<void>
  addBillRecord: (bill: Omit<Bill, 'id' | 'createdAt'>) => Promise<number>
  removeBill: (id: number) => Promise<void>

  // 分类（后期可自定义）
  expenseCategories: Category[]
  incomeCategories: Category[]

  // 刷新标记：每次记账后 +1，触发图表重算
  refreshKey: number
  triggerRefresh: () => void
}

export const useStore = create<LedgerState>((set, get) => ({
  currentMonth: getCurrentMonth(),
  setCurrentMonth: (month) => set({ currentMonth: month }),

  bills: [],
  loadBills: async () => {
    const month = get().currentMonth
    const bills = await getBillsByMonth(month)
    set({ bills })
  },
  addBillRecord: async (bill) => {
    const id = await addBill(bill)
    await get().loadBills()
    get().triggerRefresh()
    return id
  },
  removeBill: async (id) => {
    await deleteBill(id)
    await get().loadBills()
    get().triggerRefresh()
  },

  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  incomeCategories: DEFAULT_INCOME_CATEGORIES,

  refreshKey: 0,
  triggerRefresh: () => set(s => ({ refreshKey: s.refreshKey + 1 })),
}))
```

**提交:**

```bash
git add src/store/useStore.ts && git commit -m "feat: add Zustand store (bills, categories, refresh)"
```

---

## Task 8: 底部 Tab 导航布局

**Objective:** 三 Tab 布局壳（记账 / 账单 / 图表），路由切换

**Create:** `src/components/Layout.tsx`

```tsx
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/record', label: '记账', icon: '✏️' },
  { path: '/bills',  label: '账单', icon: '📋' },
  { path: '/chart',  label: '图表', icon: '📊' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex flex-col h-dvh bg-white">
      {/* 内容区 */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* 底部导航 */}
      <nav className="flex border-t border-gray-100 bg-white pb-safe">
        {tabs.map(tab => {
          const active = location.pathname.startsWith(tab.path)
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 ${
                active ? 'text-yellow-500' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
```

**Update:** `src/App.tsx`

```tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RecordPage from './pages/RecordPage'
import BillsPage from './pages/BillsPage'
import ChartPage from './pages/ChartPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/record" element={<RecordPage />} />
          <Route path="/bills"  element={<BillsPage />} />
          <Route path="/chart"  element={<ChartPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/record" replace />} />
      </Routes>
    </HashRouter>
  )
}
```

**创建页面占位:**

```bash
mkdir -p src/pages
# 手动创建三个 Page 文件（见下方）
```

`src/pages/RecordPage.tsx` (占位):
```tsx
export default function RecordPage() {
  return <div className="p-4">记账页</div>
}
```

`src/pages/BillsPage.tsx` (占位):
```tsx
export default function BillsPage() {
  return <div className="p-4">账单页</div>
}
```

`src/pages/ChartPage.tsx` (占位):
```tsx
export default function ChartPage() {
  return <div className="p-4">图表页</div>
}
```

**验证:**

```bash
npm run dev
# 浏览器打开，看到底部三个 Tab，可切换三个占位页面
```

**提交:**

```bash
git add -A && git commit -m "feat: add bottom tab navigation layout with router"
```

---

## Task 9: 记账页 — 金额输入区

**Objective:** 顶部大号金额显示 + 计算器式键盘

**Create:** `src/components/AmountInput.tsx`

```tsx
import { useState } from 'react'
import { yuanToFen } from '../utils/format'

interface Props {
  onConfirm: (amountFen: number) => void
}

export default function AmountInput({ onConfirm }: Props) {
  const [input, setInput] = useState('0')

  const handleTap = (key: string) => {
    if (key === 'C') { setInput('0'); return }
    if (key === '⌫') {
      setInput(prev => prev.length === 1 ? '0' : prev.slice(0, -1))
      return
    }
    if (key === '.') {
      if (input.includes('.')) return
      setInput(prev => prev + '.')
      return
    }
    // 数字
    setInput(prev => prev === '0' ? key : prev + key)
  }

  const displayAmount = input.includes('.')
    ? parseFloat(input).toFixed(2)
    : parseInt(input).toFixed(2)

  return (
    <div className="px-4 pt-6">
      {/* 金额显示 */}
      <div className="text-center mb-6">
        <span className="text-5xl font-bold tracking-tight">
          ¥{displayAmount}
        </span>
      </div>

      {/* 数字键盘 */}
      <div className="grid grid-cols-3 gap-2">
        {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(k => (
          <button
            key={k}
            onClick={() => handleTap(k)}
            className={`py-4 text-xl rounded-xl active:bg-gray-100 select-none ${
              k === 'C' ? 'text-gray-400' : 'font-medium'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* 确认按钮 */}
      <button
        onClick={() => onConfirm(yuanToFen(parseFloat(input)))}
        disabled={parseFloat(input) === 0}
        className="w-full mt-4 py-3 bg-yellow-400 text-black font-semibold rounded-xl
                   disabled:opacity-30 active:bg-yellow-500 transition-colors"
      >
        记一笔
      </button>
    </div>
  )
}
```

**验证:** 占位页面中引入，dev server 看效果

**提交:** 先不单独提交，等 RecordPage 组装完一起

---

## Task 10: 记账页 — 分类选择网格

**Objective:** emoji + 名称的网格，点击选中

**Create:** `src/components/CategoryGrid.tsx`

```tsx
import { Category } from '../types'

interface Props {
  categories: Category[]
  selected: string | null
  onSelect: (id: string) => void
}

export default function CategoryGrid({ categories, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
            selected === cat.id
              ? 'bg-yellow-100 ring-2 ring-yellow-400'
              : 'hover:bg-gray-50'
          }`}
        >
          <span className="text-2xl">{cat.icon}</span>
          <span className="text-xs text-gray-600">{cat.name}</span>
        </button>
      ))}
    </div>
  )
}
```

**提交:** 等 RecordPage 组装完一起

---

## Task 11: 记账页 — 整合

**Objective:** 组装收支切换 + 金额输入 + 分类 + 备注 + 日期 → 写入数据库

**Update:** `src/pages/RecordPage.tsx`

```tsx
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import AmountInput from '../components/AmountInput'
import CategoryGrid from '../components/CategoryGrid'

export default function RecordPage() {
  const { expenseCategories, incomeCategories, addBillRecord } = useStore()
  const [billType, setBillType] = useState<'expense' | 'income'>('expense')
  const [showCategory, setShowCategory] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [amountFen, setAmountFen] = useState(0)
  const [note, setNote] = useState('')

  const categories = billType === 'expense' ? expenseCategories : incomeCategories

  // 切换收支类型时重置分类
  useEffect(() => {
    setCategoryId(null)
  }, [billType])

  const handleAmountConfirm = (fen: number) => {
    setAmountFen(fen)
    setShowCategory(true)
  }

  const handleSubmit = async () => {
    if (!categoryId || amountFen === 0) return
    await addBillRecord({
      amount: amountFen,
      type: billType,
      categoryId,
      note: note.trim() || categories.find(c => c.id === categoryId)?.name || '',
      date: new Date().toISOString().slice(0, 10),
    })
    // 重置
    setShowCategory(false)
    setCategoryId(null)
    setAmountFen(0)
    setNote('')
  }

  return (
    <div className="flex flex-col h-full">
      {!showCategory ? (
        <>
          {/* 收支切换 */}
          <div className="flex justify-center gap-2 pt-4">
            <button
              onClick={() => setBillType('expense')}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${
                billType === 'expense'
                  ? 'bg-yellow-400 text-black'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              支出
            </button>
            <button
              onClick={() => setBillType('income')}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${
                billType === 'income'
                  ? 'bg-yellow-400 text-black'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              收入
            </button>
          </div>

          {/* 金额输入 */}
          <AmountInput onConfirm={handleAmountConfirm} />
        </>
      ) : (
        <div className="flex flex-col h-full px-4 pt-4">
          {/* 顶部：金额 + 日期 */}
          <div className="text-center mb-4">
            <div className="text-3xl font-bold">
              ¥{(amountFen / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-400 mt-1">{new Date().toLocaleDateString('zh-CN')}</div>
          </div>

          {/* 备注 */}
          <input
            type="text"
            placeholder="添加备注..."
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-4 py-3 mb-4 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-yellow-300"
          />

          {/* 分类网格 */}
          <div className="flex-1 overflow-auto">
            <CategoryGrid
              categories={categories}
              selected={categoryId}
              onSelect={setCategoryId}
            />
          </div>

          {/* 确认 */}
          <button
            onClick={handleSubmit}
            disabled={!categoryId || amountFen === 0}
            className="w-full py-3 mb-4 bg-yellow-400 text-black font-semibold rounded-xl
                       disabled:opacity-30 active:bg-yellow-500 transition-colors"
          >
            确认记账
          </button>
        </div>
      )}
    </div>
  )
}
```

**验证:**

```bash
npm run dev
# 1. 切到记账 Tab，看到支出/收入切换
# 2. 点支出，输入金额 12.5，点"记一笔"
# 3. 看到分类网格，选"餐饮"，点"确认记账"
# 4. 切到账单 Tab（目前还是占位），但数据已写入 IndexedDB
# 打开 DevTools → Application → IndexedDB → ledger → bills 确认有数据
```

**提交:**

```bash
git add src/components/AmountInput.tsx src/components/CategoryGrid.tsx src/pages/RecordPage.tsx
git commit -m "feat: implement full record page (amount input + category grid + submit)"
```

---

## Task 12: 账单列表页

**Objective:** 按月分组的时间线列表，显示每条账单

**Create:** `src/components/BillItem.tsx`

```tsx
import { Bill } from '../types'
import { formatMoney, formatDate } from '../utils/format'
import { useStore } from '../store/useStore'

interface Props {
  bill: Bill
}

export default function BillItem({ bill }: Props) {
  const { expenseCategories, incomeCategories } = useStore()
  const categories = bill.type === 'expense' ? expenseCategories : incomeCategories
  const cat = categories.find(c => c.id === bill.categoryId)

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-50">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{cat?.icon || '📌'}</span>
        <div>
          <div className="font-medium text-sm">{bill.note || cat?.name}</div>
          <div className="text-xs text-gray-400">{formatDate(bill.date)}</div>
        </div>
      </div>
      <div className={`text-sm font-semibold ${bill.type === 'income' ? 'text-green-500' : 'text-gray-800'}`}>
        {bill.type === 'income' ? '+' : '-'}{formatMoney(bill.amount)}
      </div>
    </div>
  )
}
```

**Update:** `src/pages/BillsPage.tsx`

```tsx
import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import BillItem from '../components/BillItem'
import { getMonthKey } from '../utils/format'

export default function BillsPage() {
  const { bills, currentMonth, loadBills, setCurrentMonth } = useStore()

  useEffect(() => {
    loadBills()
  }, [currentMonth, loadBills])

  // 按月分组
  const grouped: Record<string, typeof bills> = {}
  for (const b of bills) {
    const key = getMonthKey(b.date)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  }

  // 当月汇总
  const monthTotal = bills
    .filter(b => b.type === 'expense')
    .reduce((s, b) => s + b.amount, 0)
  const monthIncome = bills
    .filter(b => b.type === 'income')
    .reduce((s, b) => s + b.amount, 0)

  return (
    <div className="flex flex-col h-full">
      {/* 月份选择 + 汇总 */}
      <div className="p-4 border-b border-gray-100">
        <input
          type="month"
          value={currentMonth}
          onChange={e => setCurrentMonth(e.target.value)}
          className="text-lg font-bold bg-transparent outline-none"
        />
        <div className="flex gap-4 mt-2 text-sm">
          <span>支出 <span className="font-semibold text-red-500">¥{(monthTotal / 100).toFixed(2)}</span></span>
          <span>收入 <span className="font-semibold text-green-500">¥{(monthIncome / 100).toFixed(2)}</span></span>
          <span>结余 <span className="font-semibold">¥{((monthIncome - monthTotal) / 100).toFixed(2)}</span></span>
        </div>
      </div>

      {/* 账单列表 */}
      <div className="flex-1 overflow-auto">
        {bills.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">还没有账单，去记一笔吧</div>
        ) : (
          Object.entries(grouped)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([month, items]) => {
              const monthLabel = month.slice(5) + '月'
              return (
                <div key={month}>
                  <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50">{monthLabel}</div>
                  {items.map(b => (
                    <BillItem key={b.id} bill={b} />
                  ))}
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
```

**验证:**
- 切换到账单 Tab，看到之前记的账单
- 月份选择器可切换不同月份
- 支出/收入/结余正确计算

**提交:**

```bash
git add src/components/BillItem.tsx src/pages/BillsPage.tsx
git commit -m "feat: implement bill list page with monthly grouping and summary"
```

---

## Task 13: 图表页 — 月度概览 + 饼图

**Objective:** 当月支出分类饼图，收入/支出/结余数字

**Update:** `src/pages/ChartPage.tsx`

```tsx
import { useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useStore } from '../store/useStore'

const CHART_COLORS = [
  '#facc15','#f97316','#ef4444','#06b6d4','#8b5cf6',
  '#22c55e','#ec4899','#64748b','#f59e0b','#3b82f6',
  '#a855f7','#14b8a6',
]

export default function ChartPage() {
  const { bills, currentMonth, loadBills, refreshKey, expenseCategories } = useStore()

  useEffect(() => {
    loadBills()
  }, [currentMonth, refreshKey, loadBills])

  const stats = useMemo(() => {
    const monthBills = bills
    const totalExpense = monthBills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
    const totalIncome = monthBills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)

    // 分类汇总
    const catMap: Record<string, number> = {}
    for (const b of monthBills) {
      if (b.type !== 'expense') continue
      catMap[b.categoryId] = (catMap[b.categoryId] || 0) + b.amount
    }

    const breakdown = Object.entries(catMap)
      .map(([catId, amount]) => {
        const cat = expenseCategories.find(c => c.id === catId)
        return {
          categoryId: catId,
          name: cat?.name || catId,
          icon: cat?.icon || '📌',
          amount,
          percent: totalExpense > 0 ? (amount / totalExpense * 100) : 0,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    return { totalExpense, totalIncome, balance: totalIncome - totalExpense, breakdown }
  }, [bills, expenseCategories])

  const pieData = stats.breakdown.map(b => ({ name: b.name, value: b.amount / 100 }))

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* 头部概览 */}
      <div className="text-center py-6 border-b border-gray-100">
        <div className="text-sm text-gray-400">本月结余</div>
        <div className={`text-3xl font-bold mt-1 ${stats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          ¥{(stats.balance / 100).toFixed(2)}
        </div>
        <div className="flex justify-center gap-6 mt-3 text-sm">
          <span>收入 <span className="text-green-500 font-semibold">¥{(stats.totalIncome / 100).toFixed(2)}</span></span>
          <span>支出 <span className="text-red-500 font-semibold">¥{(stats.totalExpense / 100).toFixed(2)}</span></span>
        </div>
      </div>

      {/* 饼图 */}
      {pieData.length > 0 && (
        <div className="px-4 py-4">
          <div className="text-sm font-medium text-gray-500 mb-2">支出分类</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 分类排行 */}
      <div className="px-4 pb-4">
        {stats.breakdown.map((item, i) => (
          <div key={item.categoryId} className="flex items-center gap-3 py-2 border-b border-gray-50">
            <span>{item.icon}</span>
            <span className="flex-1 text-sm">{item.name}</span>
            <span className="text-sm font-medium">¥{(item.amount / 100).toFixed(2)}</span>
            <span className="text-xs text-gray-400 w-10 text-right">{item.percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**验证:**
- 切到图表 Tab，看到本月结余
- 有数据时显示饼图 + 分类排行

**提交:**

```bash
git add src/pages/ChartPage.tsx && git commit -m "feat: implement chart page with pie chart and category breakdown"
```

---

## Task 14: 数据导出（JSON）

**Objective:** 导出所有账单为 JSON 文件下载

**Create:** `src/utils/export.ts`

```ts
import { getAllBills } from '../db'

export async function exportJSON(): Promise<void> {
  const bills = await getAllBills()
  const json = JSON.stringify(bills, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importJSON(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const bills = JSON.parse(e.target?.result as string)
        if (!Array.isArray(bills)) throw new Error('格式错误')
        const { db } = await import('../db')
        let count = 0
        // 跳过 id/createdAt，用新的
        for (const b of bills) {
          await db.bills.add({
            amount: b.amount,
            type: b.type,
            categoryId: b.categoryId,
            note: b.note || '',
            date: b.date,
            createdAt: Date.now(),
          })
          count++
        }
        resolve(count)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}
```

**给账单页加导出/导入按钮 — 更新 BillsPage.tsx，在月份选择器下方加一行操作栏:**

```tsx
// 在 BillsPage 的 header 中增加，导入使用隐藏 file input
// 简化版：只加一个导出按钮

import { exportJSON, importJSON } from '../utils/export'

// 在 return 的 header div 内，月份选择器下方添加：
<div className="flex gap-2 mt-2">
  <button onClick={exportJSON} className="text-xs text-yellow-600 px-3 py-1 rounded-full bg-yellow-50 active:bg-yellow-100">
    导出 JSON
  </button>
  <label className="text-xs text-gray-500 px-3 py-1 rounded-full bg-gray-50 active:bg-gray-100 cursor-pointer">
    导入 JSON
    <input
      type="file"
      accept=".json"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
          const count = await importJSON(file)
          alert(`导入成功：${count} 条账单`)
          loadBills()
          useStore.getState().triggerRefresh()
        } catch {
          alert('导入失败，请检查文件格式')
        }
      }}
    />
  </label>
</div>
```

**验证:**
- 点"导出 JSON"，浏览器下载账单文件
- 用记事本打开确认格式正确
- 点"导入 JSON"选刚才的文件，账单恢复

**提交:**

```bash
git add src/utils/export.ts src/pages/BillsPage.tsx
git commit -m "feat: add JSON export/import for backup and restore"
```

---

## Task 15: 长按删除账单

**Objective:** 在 BillItem 上长按弹出删除确认

**Update:** `src/components/BillItem.tsx`

在已有组件基础上增加 onLongPress 逻辑：

```tsx
// 额外 import
import { useState, useRef } from 'react'
import { useStore } from '../store/useStore'

// 在组件内增加：
const { removeBill } = useStore()
const [showDelete, setShowDelete] = useState(false)
const timerRef = useRef<number>()

const handleTouchStart = () => {
  timerRef.current = window.setTimeout(() => setShowDelete(true), 500)
}
const handleTouchEnd = () => clearTimeout(timerRef.current)

// 返回的 JSX 根 div 增加事件：
<div
  className="flex items-center justify-between py-3 px-4 border-b border-gray-50"
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
  onMouseDown={handleTouchStart}
  onMouseUp={handleTouchEnd}
>
  {/* 原有内容 */}

  {/* 删除确认 */}
  {showDelete && (
    <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
      <button
        onClick={() => { removeBill(bill.id!); setShowDelete(false) }}
        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm"
      >
        确认删除
      </button>
      <button
        onClick={() => setShowDelete(false)}
        className="ml-2 px-4 py-2 bg-gray-200 rounded-lg text-sm"
      >
        取消
      </button>
    </div>
  )}
</div>
```

同时需要给 BillItem 的外层 div 加 `relative`。

**验证:** 在手机/模拟器上长按账单条目，弹出删除确认

**提交:**

```bash
git add src/components/BillItem.tsx && git commit -m "feat: add long-press to delete bill"
```

---

## Task 16: PWA 配置

**Objective:** 配置 Service Worker + manifest，让应用可安装

**Update:** `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '记账',
        short_name: '记账',
        description: '个人记账应用',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
```

**生成 logo 图标:** 你需要提供或我用简单纯色图替代。先用一个黄色方块占位。

```bash
# 用 ImageMagick 或类似工具生成简单图标（如果装了的话）
# 没有的话手动创建 192x192 和 512x512 的黄色 PNG
```

**更新:** `index.html` 需要 `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`

**验证:**

```bash
npm run build && npx serve dist
# 浏览器打开 → DevTools → Application → Manifest → 确认 PWA 可安装
```

**提交:**

```bash
git add vite.config.ts index.html public/
git commit -m "feat: add PWA config (installable, offline cache)"
```

---

## Task 17: 最终联调 + 样式打磨

**Objective:** 全流程走通，修 UI 瑕疵，确保移动端体验

清单：
- [ ] 记账 → 账单列表实时刷新
- [ ] 账单 → 图表数据一致
- [ ] 月份切换正常
- [ ] 导出后导入数据完整
- [ ] 移动端 Safari/Chrome 无布局问题
- [ ] PWA 安装到桌面正常打开
- [ ] 断网后 Service Worker 返回缓存页面

**提交:**

```bash
git add -A && git commit -m "polish: final UI tweaks and integration verification"
```

---

## Task 18: 部署 GitHub Pages

**Objective:** 构建并部署到 GitHub Pages，生成公开 URL

**Update:** `vite.config.ts` 加 `base: '/ledger/'`

```bash
npm run build
# 构建产物在 dist/

# 安装 gh-pages
npm install -D gh-pages

# 在 package.json 加 script:
# "deploy": "gh-pages -d dist"

npm run deploy
```

**验证:** 打开 `https://leluaizuguo.github.io/ledger/`，手机浏览器打开可安装 PWA

**提交:**

```bash
git add vite.config.ts package.json && git commit -m "chore: configure GitHub Pages deployment"
git push
```

---

## 验收标准

V1 完成后应满足：

- [x] 支出/收入记账，选分类 + 备注 + 日期
- [x] 所有数据存 IndexedDB，刷新不丢失
- [x] 账单列表按月份浏览，月度汇总
- [x] 图表页：结余 + 分类饼图 + 排行
- [x] JSON 导出/导入备份恢复
- [x] 长按删除账单
- [x] PWA 可安装，离线可用
- [x] GitHub Pages 部署，手机可访问
