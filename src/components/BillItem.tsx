import { useState, useRef } from 'react'
import { Bill } from '../types'
import { formatMoney, formatDate } from '../utils/format'
import { useStore } from '../store/useStore'

interface Props { bill: Bill }

export default function BillItem({ bill }: Props) {
  const { expenseCategories, incomeCategories, removeBill } = useStore()
  const categories = bill.type === 'expense' ? expenseCategories : incomeCategories
  const cat = categories.find(c => c.id === bill.categoryId)
  const [showDelete, setShowDelete] = useState(false)
  const timerRef = useRef<number>()

  const startPress = () => { timerRef.current = window.setTimeout(() => setShowDelete(true), 500) }
  const endPress = () => clearTimeout(timerRef.current)

  return (
    <div className="relative flex items-center justify-between py-3 px-4 border-b border-gray-50"
      onTouchStart={startPress} onTouchEnd={endPress} onMouseDown={startPress} onMouseUp={endPress}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{cat?.icon || '📌'}</span>
        <div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm">{bill.note || cat?.name}</span>
            {bill.isReimbursable && !bill.reimbursed && (
              <span className="text-xs bg-orange-100 text-orange-500 px-1.5 rounded">待报销</span>
            )}
            {bill.reimbursed && (
              <span className="text-xs bg-green-100 text-green-500 px-1.5 rounded">已报销</span>
            )}
          </div>
          <div className="text-xs text-gray-400">{formatDate(bill.date)}</div>
        </div>
      </div>
      <div className={`text-sm font-semibold ${bill.type === 'income' ? 'text-green-500' : 'text-gray-800'}`}>
        {bill.type === 'income' ? '+' : '-'}{formatMoney(bill.amount)}
      </div>

      {showDelete && (
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-white/95 z-10 rounded">
          <span className="text-xs text-gray-500">删除这条账单？</span>
          <button onClick={() => { removeBill(bill.id!); setShowDelete(false) }}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium">删除</button>
          <button onClick={() => setShowDelete(false)}
            className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs">取消</button>
        </div>
      )}
    </div>
  )
}
