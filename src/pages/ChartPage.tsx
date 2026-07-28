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

      <div className="px-4 pb-4">
        {stats.breakdown.map((item) => (
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
