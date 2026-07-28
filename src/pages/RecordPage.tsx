import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import AmountInput from '../components/AmountInput'
import CategoryGrid from '../components/CategoryGrid'
import { getTodayISO } from '../utils/format'

export default function RecordPage() {
  const { expenseCategories, incomeCategories, accounts, loadAccounts, addBillRecord } = useStore()
  const [billType, setBillType] = useState<'expense' | 'income'>('expense')
  const [showCategory, setShowCategory] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('cash')
  const [amountFen, setAmountFen] = useState(0)
  const [note, setNote] = useState('')

  const categories = billType === 'expense' ? expenseCategories : incomeCategories

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { setCategoryId(null) }, [billType])

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
      accountId,
      note: note.trim() || categories.find(c => c.id === categoryId)?.name || '',
      date: getTodayISO(),
    })
    setShowCategory(false)
    setCategoryId(null)
    setAmountFen(0)
    setNote('')
  }

  return (
    <div className="flex flex-col h-full">
      {!showCategory ? (
        <>
          <div className="flex justify-center gap-2 pt-4">
            <button
              onClick={() => setBillType('expense')}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${
                billType === 'expense' ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-500'
              }`}
            >
              支出
            </button>
            <button
              onClick={() => setBillType('income')}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${
                billType === 'income' ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-500'
              }`}
            >
              收入
            </button>
          </div>

          {/* 账户选择 */}
          <div className="flex justify-center gap-1 px-4 mt-3 overflow-x-auto">
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${
                  accountId === a.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {a.icon} {a.name}
              </button>
            ))}
          </div>

          <AmountInput onConfirm={handleAmountConfirm} />
        </>
      ) : (
        <div className="flex flex-col h-full px-4 pt-4">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold">¥{(amountFen / 100).toFixed(2)}</div>
            <div className="text-sm text-gray-400 mt-1">{new Date().toLocaleDateString('zh-CN')}</div>
          </div>
          <input
            type="text" placeholder="添加备注..." value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-4 py-3 mb-4 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-yellow-300"
          />
          <div className="flex-1 overflow-auto">
            <CategoryGrid categories={categories} selected={categoryId} onSelect={setCategoryId} />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!categoryId || amountFen === 0}
            className="w-full py-3 mb-4 bg-yellow-400 text-black font-semibold rounded-xl disabled:opacity-30 active:bg-yellow-500"
          >
            确认记账
          </button>
        </div>
      )}
    </div>
  )
}
