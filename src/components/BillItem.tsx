import { useState, useRef } from 'react'
import { Bill } from '../types'
import { formatMoney, formatDate, getTodayISO } from '../utils/format'
import { useStore } from '../store/useStore'

interface Props { bill: Bill }

export default function BillItem({ bill }: Props) {
  const { expenseCategories, incomeCategories, accounts, removeBill, updateBillRecord, currentUser } = useStore()
  const categories = bill.type === 'expense' ? expenseCategories : incomeCategories
  const cat = categories.find(c => c.id === bill.categoryId)
  const [showAction, setShowAction] = useState(false)
  const [editing, setEditing] = useState(false)
  const timerRef = useRef<number>()

  // Edit form state
  const [editAmount, setEditAmount] = useState('')
  const [editType, setEditType] = useState(bill.type)
  const [editCategory, setEditCategory] = useState(bill.categoryId)
  const [editAccount, setEditAccount] = useState(bill.accountId)
  const [editNote, setEditNote] = useState(bill.note)
  const [editDate, setEditDate] = useState(bill.date)

  // Only allow editing own bills
  const isOwn = !bill.display_name || !currentUser || bill.user_id === currentUser.id

  const startPress = () => { timerRef.current = window.setTimeout(() => setShowAction(true), 800) }
  const cancelPress = () => { clearTimeout(timerRef.current); setShowAction(false) }
  const endPress = () => clearTimeout(timerRef.current)

  const openEdit = () => {
    setEditAmount((bill.amount / 100).toFixed(2))
    setEditType(bill.type)
    setEditCategory(bill.categoryId)
    setEditAccount(bill.accountId)
    setEditNote(bill.note)
    setEditDate(bill.date)
    setShowAction(false)
    setEditing(true)
  }

  const handleSave = async () => {
    const fen = Math.round(parseFloat(editAmount) * 100)
    if (!fen || isNaN(fen)) return
    await updateBillRecord(bill.id!, {
      amount: fen,
      type: editType,
      categoryId: editCategory,
      accountId: editAccount,
      note: editNote.trim(),
      date: editDate,
    })
    setEditing(false)
  }

  const editCats = editType === 'expense' ? expenseCategories : incomeCategories

  return (
    <>
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
            <button onClick={openEdit}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium">修改</button>
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

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-30 bg-black/30 flex items-end sm:items-center justify-center"
          onClick={() => setEditing(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-auto shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b dark:border-gray-800 font-semibold dark:text-white flex justify-between">
              <span>修改账单</span>
              <button onClick={() => setEditing(false)} className="text-gray-400 text-lg leading-none">×</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Type toggle */}
              <div className="flex justify-center gap-2">
                <button onClick={() => { setEditType('expense'); setEditCategory('') }}
                  className={`px-6 py-2 rounded-full text-sm font-medium ${editType === 'expense' ? 'bg-yellow-400 text-black' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>支出</button>
                <button onClick={() => { setEditType('income'); setEditCategory('') }}
                  className={`px-6 py-2 rounded-full text-sm font-medium ${editType === 'income' ? 'bg-yellow-400 text-black' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>收入</button>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">金额</label>
                <input type="number" step="0.01" value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-lg text-lg font-semibold outline-none focus:ring-2 focus:ring-yellow-300" />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">分类</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
                  {editCats.map(c => (
                    <button key={c.id} onClick={() => setEditCategory(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs ${editCategory === c.id ? 'bg-yellow-400 text-black' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">账户</label>
                <div className="flex flex-wrap gap-2">
                  {accounts.map(a => (
                    <button key={a.id} onClick={() => setEditAccount(a.id)}
                      className={`px-3 py-1.5 rounded-full text-xs ${editAccount === a.id ? 'bg-gray-800 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}>
                      {a.icon} {a.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">备注</label>
                <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-lg text-sm outline-none" />
              </div>

              {/* Date */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">日期</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-lg text-sm outline-none" />
              </div>
            </div>

            <div className="p-4 border-t dark:border-gray-800 flex gap-2">
              <button onClick={handleSave}
                className="flex-1 py-2.5 bg-yellow-400 text-black font-semibold rounded-xl active:bg-yellow-500">
                保存修改
              </button>
              <button onClick={() => setEditing(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-xl text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
