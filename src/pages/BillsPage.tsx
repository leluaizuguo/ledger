import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import BillItem from '../components/BillItem'
import { getMonthKey } from '../utils/format'
import { exportJSON, importJSON, exportCSV } from '../utils/export'

export default function BillsPage() {
  const { bills, currentMonth, loadBills, setCurrentMonth, searchQuery, setSearchQuery } = useStore()

  useEffect(() => { loadBills() }, [currentMonth, searchQuery, loadBills])

  const grouped: Record<string, typeof bills> = {}
  for (const b of bills) {
    const key = getMonthKey(b.date)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  }

  const monthTotal = bills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
  const monthIncome = bills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <div className="flex gap-2">
          <input type="month" value={currentMonth}
            onChange={e => setCurrentMonth(e.target.value)}
            className="text-lg font-bold bg-transparent outline-none flex-1" />
          <button onClick={exportJSON}
            className="text-xs text-yellow-600 px-3 py-1 rounded-full bg-yellow-50 active:bg-yellow-100">JSON</button>
          <button onClick={exportCSV}
            className="text-xs text-green-600 px-3 py-1 rounded-full bg-green-50 active:bg-green-100">CSV</button>
          <label className="text-xs text-gray-500 px-3 py-1 rounded-full bg-gray-50 active:bg-gray-100 cursor-pointer">
            导入
            <input type="file" accept=".json" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try { const c = await importJSON(file); alert(`导入 ${c} 条`); loadBills() }
                catch { alert('格式错误') }
              }} />
          </label>
        </div>
        <div className="flex gap-4 mt-2 text-sm">
          <span>支出 <span className="font-semibold text-red-500">¥{(monthTotal / 100).toFixed(2)}</span></span>
          <span>收入 <span className="font-semibold text-green-500">¥{(monthIncome / 100).toFixed(2)}</span></span>
          <span>结余 <span className="font-semibold">¥{((monthIncome - monthTotal) / 100).toFixed(2)}</span></span>
        </div>
        {/* 搜索框 */}
        <input type="search" placeholder="搜索账单..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full mt-2 px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none" />
      </div>

      <div className="flex-1 overflow-auto">
        {bills.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">{searchQuery ? '没有匹配的账单' : '还没有账单，去记一笔吧'}</div>
        ) : (
          Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
            .map(([month, items]) => (
              <div key={month}>
                <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50">{parseInt(month.slice(5))}月</div>
                {items.map(b => <BillItem key={b.id} bill={b} />)}
              </div>
            ))
        )}
      </div>
    </div>
  )
}
