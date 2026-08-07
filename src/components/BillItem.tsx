import { useState, useRef } from 'react'
import { Bill } from '../types'
import { formatMoney, formatDate, getTodayISO } from '../utils/format'
import { useStore } from '../store/useStore'

interface Props { bill: Bill }

export default function BillItem({ bill }: Props) {
  const { expenseCategories, incomeCategories, removeBill, addBillRecord, currentUser } = useStore()
  const categories = bill.type === 'expense' ? expenseCategories : incomeCategories
  const cat = categories.find(c => c.id === bill.categoryId)
  const [showAction, setShowAction] = useState(false)
  const timerRef = useRef<number>()

  // Only allow deleting own bills
  const isOwn = !bill.display_name || !currentUser || bill.user_id === currentUser.id

  const startPress = () => { timerRef.current = window.setTimeout(() => setShowAction(true), 800) }
  const cancelPress = () => { clearTimeout(timerRef.current); setShowAction(false) }
  const endPress = () => clearTimeout(timerRef.current)

  const handleRefund = async () => {
    await addBillRecord({
      amount: bill.amount,
      type: 'income',
      categoryId: 'other_inc',
      accountId: bill.accountId,
      note: `退款：${bill.note}`,
      date: getTodayISO(),
      isReimbursable: false,
    })
    setShowAction(false)
  }

  return (
    <div className="relative flex items-center justify-between py-3 px-4 border-b border-gray-50 dark:border-gray-800"
      onTouchStart={startPress} onTouchEnd={endPress} onTouchMove={cancelPress}
      onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={cancelPress}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{cat?.icon || '📌'}</span>
        <div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm dark:text-gray-200">{bill.note || cat?.name}</span>
            {bill.display_name && <span className="text-xs text-gray-400">· {bill.display_name}</span>}
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
      <div className={`text-sm font-semibold ${bill.type === 'income' ? 'text-green-500' : 'text-gray-800 dark:text-gray-200'}`}>
        {bill.type === 'income' ? '+' : '-'}{formatMoney(bill.amount)}
      </div>
      {bill.accountId && (
        <span className="text-xs text-gray-400 ml-1">{bill.accountId === 'cash' ? '💵' : bill.accountId === 'debit' ? '🏦' : bill.accountId === 'credit' ? '💳' : bill.accountId === 'alipay' ? '🔵' : bill.accountId === 'wechat' ? '🟢' : ''}</span>
      )}
      {bill.imageData && (
        <img src={bill.imageData} alt="" className="ml-2 h-10 w-10 rounded object-cover" />
      )}

      {showAction && isOwn && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/95 dark:bg-gray-900/95 z-10 rounded">
          {bill.type === 'expense' && (
            <button onClick={handleRefund}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium">退款</button>
          )}
          <button onClick={() => { removeBill(bill.id!); setShowAction(false) }}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium">删除</button>
          <button onClick={() => setShowAction(false)}
            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs">取消</button>
        </div>
      )}
      {showAction && !isOwn && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/95 dark:bg-gray-900/95 z-10 rounded">
          <span className="text-xs text-gray-400 mr-2">· {bill.display_name}</span>
          <button onClick={() => setShowAction(false)}
            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs">关闭</button>
        </div>
      )}
    </div>
  )
}
