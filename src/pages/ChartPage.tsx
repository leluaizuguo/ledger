import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useStore } from '../store/useStore'
import { getBillsByMonth } from '../db'
import { getCurrentMonth } from '../utils/format'

const CHART_COLORS = [
  '#facc15','#f97316','#ef4444','#06b6d4','#8b5cf6',
  '#22c55e','#ec4899','#64748b','#f59e0b','#3b82f6',
  '#a855f7','#14b8a6',
]

export default function ChartPage() {
  const { bills, currentMonth, loadBills, refreshKey, expenseCategories, budget, loadBudget, saveBudget } = useStore()
  const [trendData, setTrendData] = useState<{ month: string; expense: number; income: number }[]>([])
  const [showBudgetInput, setShowBudgetInput] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')

  useEffect(() => { loadBills(); loadBudget() }, [currentMonth, refreshKey, loadBills, loadBudget])

  // 近6月趋势
  useEffect(() => {
    (async () => {
      const now = new Date()
      const months: { month: string; expense: number; income: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const b = await getBillsByMonth(key)
        months.push({
          month: key.slice(5) + '月',
          expense: (b.filter(x => x.type === 'expense').reduce((s, x) => s + x.amount, 0) / 100),
          income: (b.filter(x => x.type === 'income').reduce((s, x) => s + x.amount, 0) / 100),
        })
      }
      setTrendData(months)
    })()
  }, [currentMonth, refreshKey])

  const stats = useMemo(() => {
    const totalExpense = bills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
    const totalIncome = bills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
    const catMap: Record<string, number> = {}
    for (const b of bills) {
      if (b.type !== 'expense') continue
      catMap[b.categoryId] = (catMap[b.categoryId] || 0) + b.amount
    }
    const breakdown = Object.entries(catMap)
      .map(([catId, amount]) => {
        const cat = expenseCategories.find(c => c.id === catId)
        return { categoryId: catId, name: cat?.name || catId, icon: cat?.icon || '📌', amount,
          percent: totalExpense > 0 ? (amount / totalExpense * 100) : 0 }
      })
      .sort((a, b) => b.amount - a.amount)
    return { totalExpense, totalIncome, balance: totalIncome - totalExpense, breakdown,
      dailyAvg: totalExpense / Math.max(new Date().getDate(), 1),
    }
  }, [bills, expenseCategories])

  const pieData = stats.breakdown.map(b => ({ name: b.name, value: b.amount / 100 }))
  const budgetPercent = budget && budget > 0 ? Math.min(stats.totalExpense / budget * 100, 100) : 0

  // 环比变化
  const momChange = trendData.length >= 2
    ? (trendData[trendData.length - 1].expense - trendData[trendData.length - 2].expense) / Math.max(trendData[trendData.length - 2].expense, 1) * 100
    : 0

  return (
    <div className="flex flex-col h-full overflow-auto pb-4">
      {/* 结余 */}
      <div className="text-center py-4 border-b border-gray-100">
        <div className="text-sm text-gray-400">本月结余</div>
        <div className={`text-3xl font-bold mt-1 ${stats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          ¥{(stats.balance / 100).toFixed(2)}
        </div>
        <div className="flex justify-center gap-6 mt-2 text-sm">
          <span>收入 <span className="text-green-500 font-semibold">¥{(stats.totalIncome / 100).toFixed(2)}</span></span>
          <span>支出 <span className="text-red-500 font-semibold">¥{(stats.totalExpense / 100).toFixed(2)}</span></span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          日均支出 ¥{(stats.dailyAvg / 100).toFixed(2)}
          {trendData.length >= 2 && (
            <span className={momChange > 0 ? 'text-red-400' : 'text-green-400'}> · 环比 {momChange > 0 ? '+' : ''}{momChange.toFixed(0)}%</span>
          )}
        </div>
      </div>

      {/* 预算进度条 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-500">月度预算</span>
          {budget ? (
            <button onClick={() => { setBudgetInput(String(budget / 100)); setShowBudgetInput(true) }}
              className="text-xs text-yellow-600">
              ¥{(budget / 100).toFixed(0)}
            </button>
          ) : (
            <button onClick={() => setShowBudgetInput(true)} className="text-xs text-yellow-600">设置预算</button>
          )}
        </div>
        {showBudgetInput ? (
          <div className="flex gap-2">
            <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
              placeholder="月预算（元）" className="flex-1 px-3 py-1 border rounded text-sm" autoFocus />
            <button onClick={() => {
              const v = Math.round(parseFloat(budgetInput) * 100)
              if (v > 0) saveBudget(v)
              setShowBudgetInput(false)
            }} className="px-3 py-1 bg-yellow-400 rounded text-sm font-medium">确定</button>
            <button onClick={() => setShowBudgetInput(false)} className="px-3 py-1 bg-gray-100 rounded text-sm">取消</button>
          </div>
        ) : budget ? (
          <div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${budgetPercent}%` }} />
            </div>
            <div className="text-xs text-gray-400 mt-1">
              已用 ¥{(stats.totalExpense / 100).toFixed(0)} / ¥{(budget / 100).toFixed(0)}（{budgetPercent.toFixed(0)}%）
            </div>
          </div>
        ) : null}
      </div>

      {/* 趋势折线图 */}
      {trendData.length > 0 && (
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-2">近6月趋势</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={50} />
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
              <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="支出" />
              <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="收入" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 饼图 */}
      {pieData.length > 0 && (
        <div className="px-4 py-4">
          <div className="text-sm font-medium text-gray-500 mb-2">支出分类</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
              </Pie>
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 分类排行 */}
      <div className="px-4">
        {stats.breakdown.map(item => (
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
