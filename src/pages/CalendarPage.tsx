import { useEffect, useMemo } from 'react'
import { useStore } from '../store/useStore'

export default function CalendarPage() {
  const { bills, currentMonth, loadBills, setCurrentMonth, expenseCategories } = useStore()

  useEffect(() => { loadBills() }, [currentMonth, loadBills])

  const calendar = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1).getDay()
    const daysInMonth = new Date(y, m, 0).getDate()

    // 每日金额汇总
    const dailyMap: Record<string, { expense: number; income: number }> = {}
    for (const b of bills) {
      const day = b.date.slice(8)
      if (!dailyMap[day]) dailyMap[day] = { expense: 0, income: 0 }
      if (b.type === 'expense') dailyMap[day].expense += b.amount
      else if (b.type === 'income') dailyMap[day].income += b.amount
    }

    const days: { day: number; expense: number; income: number }[] = []
    for (let i = 0; i < firstDay; i++) days.push({ day: 0, expense: 0, income: 0 })
    for (let d = 1; d <= daysInMonth; d++) {
      const key = String(d).padStart(2, '0')
      days.push({ day: d, ...(dailyMap[key] || { expense: 0, income: 0 }) })
    }

    return days
  }, [bills, currentMonth])

  const goMonth = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <button onClick={() => goMonth(-1)} className="text-lg px-2">◀</button>
        <span className="text-lg font-bold dark:text-white">{currentMonth}</span>
        <button onClick={() => goMonth(1)} className="text-lg px-2">▶</button>
      </div>

      {/* 星期头 */}
      <div className="grid grid-cols-7 text-center text-xs text-gray-400 py-2 border-b dark:border-gray-800">
        {['日','一','二','三','四','五','六'].map(w => <div key={w}>{w}</div>)}
      </div>

      {/* 日历网格 */}
      <div className="grid grid-cols-7 flex-1">
        {calendar.map((d, i) => (
          <div key={i} className={`border-b border-r border-gray-50 dark:border-gray-800 p-1 text-xs ${
            d.day === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''
          }`}>
            {d.day > 0 && (
              <>
                <div className="text-gray-500 dark:text-gray-400 mb-0.5">{d.day}</div>
                {d.expense > 0 && (
                  <div className="text-red-500 font-medium leading-tight">
                    ¥{(d.expense / 100).toFixed(0)}
                  </div>
                )}
                {d.income > 0 && (
                  <div className="text-green-500 leading-tight">
                    +{(d.income / 100).toFixed(0)}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
