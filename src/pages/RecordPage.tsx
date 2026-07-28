import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import AmountInput from '../components/AmountInput'
import CategoryGrid from '../components/CategoryGrid'
import { getTodayISO } from '../utils/format'

export default function RecordPage() {
  const { expenseCategories, incomeCategories, accounts, loadAccounts, addBillRecord,
    templates, loadTemplates, removeTemplate, addTemplate } = useStore()
  const [billType, setBillType] = useState<'expense' | 'income'>('expense')
  const [showCategory, setShowCategory] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('cash')
  const [amountFen, setAmountFen] = useState(0)
  const [note, setNote] = useState('')
  const [isReimbursable, setIsReimbursable] = useState(false)

  const categories = billType === 'expense' ? expenseCategories : incomeCategories

  useEffect(() => { loadAccounts(); loadTemplates() }, [loadAccounts, loadTemplates])
  useEffect(() => { setCategoryId(null) }, [billType])

  const applyTemplate = (tpl: typeof templates[0]) => {
    setBillType(tpl.type)
    setAmountFen(tpl.amount)
    setCategoryId(tpl.categoryId)
    setAccountId(tpl.accountId)
    setNote(tpl.note)
    setShowCategory(true)
  }

  const handleAmountConfirm = (fen: number) => {
    setAmountFen(fen)
    setShowCategory(true)
  }

  const handleSubmit = async () => {
    if (!categoryId || amountFen === 0) return
    await addBillRecord({
      amount: amountFen, type: billType, categoryId, accountId,
      note: note.trim() || categories.find(c => c.id === categoryId)?.name || '',
      date: getTodayISO(), isReimbursable,
    })
    setShowCategory(false); setCategoryId(null); setAmountFen(0); setNote(''); setIsReimbursable(false)
  }

  const handleSaveAsTemplate = async () => {
    const name = prompt('模板名称：', note || categories.find(c => c.id === categoryId)?.name || '')
    if (!name || !categoryId || amountFen === 0) return
    await addTemplate({ name, amount: amountFen, type: billType, categoryId, accountId, note })
  }

  return (
    <div className="flex flex-col h-full">
      {!showCategory ? (
        <>
          <div className="flex justify-center gap-2 pt-4">
            <button onClick={() => setBillType('expense')}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${billType === 'expense' ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-500'}`}>支出</button>
            <button onClick={() => setBillType('income')}
              className={`px-6 py-2 rounded-full font-medium transition-colors ${billType === 'income' ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-500'}`}>收入</button>
          </div>
          <div className="flex justify-center gap-1 px-4 mt-3 overflow-x-auto">
            {accounts.map(a => (
              <button key={a.id} onClick={() => setAccountId(a.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${accountId === a.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {a.icon} {a.name}
              </button>
            ))}
          </div>

          {/* 模板快捷入口 */}
          {templates.filter(t => t.type === billType).length > 0 && (
            <div className="px-4 mt-3">
              <div className="text-xs text-gray-400 mb-2">常用模板</div>
              <div className="flex gap-2 overflow-x-auto">
                {templates.filter(t => t.type === billType).map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    className="shrink-0 px-3 py-1.5 bg-gray-50 rounded-full text-xs active:bg-yellow-100">
                    {t.name} ¥{(t.amount / 100).toFixed(0)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AmountInput onConfirm={handleAmountConfirm} />
        </>
      ) : (
        <div className="flex flex-col h-full px-4 pt-4">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold">¥{(amountFen / 100).toFixed(2)}</div>
            <div className="text-sm text-gray-400 mt-1">{new Date().toLocaleDateString('zh-CN')}</div>
          </div>
          <input type="text" placeholder="添加备注..." value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-4 py-3 mb-2 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-yellow-300" />
          {/* 报销标记 */}
          <label className="flex items-center gap-2 mb-2 text-sm text-gray-500">
            <input type="checkbox" checked={isReimbursable} onChange={e => setIsReimbursable(e.target.checked)}
              className="w-4 h-4 accent-yellow-400" />
            标记为待报销
          </label>
          <div className="flex-1 overflow-auto">
            <CategoryGrid categories={categories} selected={categoryId} onSelect={setCategoryId} />
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={handleSubmit} disabled={!categoryId || amountFen === 0}
              className="flex-1 py-3 bg-yellow-400 text-black font-semibold rounded-xl disabled:opacity-30 active:bg-yellow-500">确认记账</button>
            <button onClick={handleSaveAsTemplate} disabled={!categoryId || amountFen === 0}
              className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm active:bg-gray-200">存模板</button>
          </div>
        </div>
      )}
    </div>
  )
}
