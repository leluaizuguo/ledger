import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import BillItem from '../components/BillItem'
import { getMonthKey } from '../utils/format'
import { exportJSON, importJSON } from '../utils/export'

export default function BillsPage() {
  const { bills, currentMonth, loadBills, setCurrentMonth } = useStore()

  useEffect(() => {
    loadBills()
  }, [currentMonth, loadBills])

  const grouped: Record<string, typeof bills> = {}
  for (const b of bills) {
    const key = getMonthKey(b.date)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  }

  const monthTotal = bills
    .filter(b => b.type === 'expense')
    .reduce((s, b) => s + b.amount, 0)
  const monthIncome = bills
    .filter(b => b.type === 'income')
    .reduce((s, b) => s + b.amount, 0)

  return (
    <div className="flex flex-col h-full">
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
        <div className="flex gap-2 mt-2">
          <button onClick={exportJSON} className="text-xs text-yellow-600 px-3 py-1 rounded-full bg-yellow-50 active:bg-yellow-100">
            导出
          </button>
          <label className="text-xs text-gray-500 px-3 py-1 rounded-full bg-gray-50 active:bg-gray-100 cursor-pointer">
            导入
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
      </div>

      <div className="flex-1 overflow-auto">
        {bills.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">还没有账单，去记一笔吧</div>
        ) : (
          Object.entries(grouped)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([month, items]) => {
              const monthLabel = parseInt(month.slice(5)) + '月'
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
