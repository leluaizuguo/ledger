import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { getAccounts, updateAccountBalance } from '../db'
import { BillTemplate, RecurringBill } from '../types'

export default function AccountPage() {
  const { accounts, loadAccounts,
    templates, loadTemplates, addTemplate, removeTemplate,
    recurrings, loadRecurrings, addRecurring, toggleRecurring, removeRecurring,
    installments, loadInstallments, addInstallment,
    bills,
  } = useStore()
  const [tab, setTab] = useState<'accounts' | 'recurring' | 'templates' | 'installments'>('accounts')

  useEffect(() => { loadAccounts(); loadRecurrings(); loadTemplates(); loadInstallments() },
    [loadAccounts, loadRecurrings, loadTemplates, loadInstallments])

  const handleEditBalance = async (id: string, name: string) => {
    const v = prompt(`修改 ${name} 余额（元）：`)
    if (v === null) return
    const fen = Math.round(parseFloat(v) * 100)
    if (isNaN(fen)) return
    await updateAccountBalance(id, fen)
    await loadAccounts()
  }

  const totalBalance = accounts.reduce((s, a) => {
    return s + (a.type === 'credit' ? -a.balance : a.balance)
  }, 0)

  return (
    <div className="flex flex-col h-full">
      {/* 总资产 */}
      <div className="p-4 border-b border-gray-100">
        <div className="text-sm text-gray-400">总资产</div>
        <div className={`text-3xl font-bold mt-1 ${totalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          ¥{(totalBalance / 100).toFixed(2)}
        </div>
      </div>

      {/* 子 Tab */}
      <div className="flex border-b border-gray-100">
        {[
          { id: 'accounts', label: '账户' },
          { id: 'recurring', label: '周期' },
          { id: 'templates', label: '模板' },
          { id: 'installments', label: '分期' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`flex-1 py-2 text-sm ${tab === t.id ? 'text-yellow-500 border-b-2 border-yellow-400 font-medium' : 'text-gray-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* 账户列表 */}
        {tab === 'accounts' && accounts.map(a => (
          <div key={a.id} className="flex items-center justify-between py-3 px-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{a.icon}</span>
              <div>
                <div className="font-medium text-sm">{a.name}</div>
                <div className="text-xs text-gray-400">{a.type === 'cash' ? '现金' : a.type === 'bank' ? '借记卡' : a.type === 'credit' ? '信用卡' : a.type === 'ewallet' ? '电子钱包' : '投资'}</div>
              </div>
            </div>
            <button onClick={() => handleEditBalance(a.id, a.name)} className="text-sm font-semibold text-right">
              {a.type === 'credit' ? `-¥${(a.balance / 100).toFixed(2)}` : `¥${(a.balance / 100).toFixed(2)}`}
            </button>
          </div>
        ))}

        {/* 周期账单 */}
        {tab === 'recurring' && (
          <div>
            <AddRecurring onAdd={addRecurring} />
            {recurrings.length === 0 && <div className="text-center text-gray-400 mt-10 text-sm">暂无周期账单</div>}
            {recurrings.map(r => (
              <div key={r.id} className="flex items-center justify-between py-3 px-4 border-b border-gray-50">
                <div className="flex-1">
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="text-xs text-gray-400">
                    {r.type === 'expense' ? '支出' : '收入'} · 每月{r.dayOfMonth}日 · ¥{(r.amount / 100).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleRecurring(r.id!, !r.active)}
                    className={`text-xs px-2 py-1 rounded ${r.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {r.active ? '开启' : '暂停'}
                  </button>
                  <button onClick={() => removeRecurring(r.id!)} className="text-xs text-red-400">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 模板 */}
        {tab === 'templates' && (
          <div>
            <AddTemplate onAdd={addTemplate} categories={useStore.getState().expenseCategories} />
            {templates.length === 0 && <div className="text-center text-gray-400 mt-10 text-sm">暂无模板</div>}
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between py-3 px-4 border-b border-gray-50">
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-gray-400">{t.type === 'expense' ? '支出' : '收入'} · ¥{(t.amount / 100).toFixed(2)} · {t.note}</div>
                </div>
                <button onClick={() => removeTemplate(t.id!)} className="text-xs text-red-400">删除</button>
              </div>
            ))}
          </div>
        )}

        {/* 分期 */}
        {tab === 'installments' && (
          <div>
            <div className="p-4">
              <button onClick={() => {
                const billId = prompt('输入要分期的账单 ID（可在账单列表中查看）:')
                if (!billId) return
                const bill = bills.find(b => b.id === parseInt(billId))
                if (!bill) { alert('找不到账单'); return }
                const periods = parseInt(prompt('分期期数：', '3') || '3')
                if (isNaN(periods) || periods <= 1) return
                const periodAmount = Math.round(bill.amount / periods)
                addInstallment({
                  billId: bill.id!, totalAmount: bill.amount, periods,
                  periodAmount, startMonth: bill.date.slice(0, 7),
                  note: bill.note, currentPeriod: 0,
                })
              }} className="w-full py-2 bg-yellow-400 text-black rounded-lg text-sm font-medium">
                新建分期
              </button>
            </div>
            {installments.length === 0 && <div className="text-center text-gray-400 mt-4 text-sm">暂无分期</div>}
            {installments.map(i => (
              <div key={i.id} className="py-3 px-4 border-b border-gray-50">
                <div className="font-medium text-sm">{i.note || '分期账单'}</div>
                <div className="text-xs text-gray-400 mt-1">
                  总额 ¥{(i.totalAmount / 100).toFixed(2)} · {i.periods}期 · 每期 ¥{(i.periodAmount / 100).toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">
                  起始 {i.startMonth} · 已生成 {i.currentPeriod}/{i.periods} 期
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// 添加周期账单组件
function AddRecurring({ onAdd }: { onAdd: (r: Omit<RecurringBill, 'id'>) => Promise<void> }) {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [day, setDay] = useState('1')

  if (!show) return <button onClick={() => setShow(true)} className="w-full py-2 text-sm text-yellow-600">+ 添加周期账单</button>

  return (
    <div className="p-4 border-b border-gray-100 space-y-2">
      <div className="flex gap-2">
        <button onClick={() => setType('expense')} className={`flex-1 py-1 rounded text-sm ${type === 'expense' ? 'bg-yellow-400' : 'bg-gray-100'}`}>支出</button>
        <button onClick={() => setType('income')} className={`flex-1 py-1 rounded text-sm ${type === 'income' ? 'bg-yellow-400' : 'bg-gray-100'}`}>收入</button>
      </div>
      <input placeholder="名称（如：房租）" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 rounded text-sm" />
      <input placeholder="金额（元）" value={amount} type="number" onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 bg-gray-50 rounded text-sm" />
      <input placeholder="每月几号" value={day} type="number" min="1" max="28" onChange={e => setDay(e.target.value)} className="w-full px-3 py-2 bg-gray-50 rounded text-sm" />
      <div className="flex gap-2">
        <button onClick={async () => {
          const a = parseFloat(amount); if (!name || !a) return
          await onAdd({ name, amount: Math.round(a * 100), type, categoryId: type === 'expense' ? 'housing' : 'salary', accountId: 'debit', dayOfMonth: parseInt(day), active: true })
          setName(''); setAmount(''); setShow(false)
        }} className="flex-1 py-2 bg-yellow-400 rounded text-sm font-medium">保存</button>
        <button onClick={() => setShow(false)} className="px-4 py-2 bg-gray-100 rounded text-sm">取消</button>
      </div>
    </div>
  )
}

// 添加模板组件
function AddTemplate({ onAdd, categories }: { onAdd: (t: Omit<BillTemplate, 'id'>) => Promise<void>, categories: { id: string, name: string, icon: string }[] }) {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [catId, setCatId] = useState('food')

  if (!show) return <button onClick={() => setShow(true)} className="w-full py-2 text-sm text-yellow-600">+ 添加模板</button>

  return (
    <div className="p-4 border-b border-gray-100 space-y-2">
      <div className="flex gap-2">
        <button onClick={() => setType('expense')} className={`flex-1 py-1 rounded text-sm ${type === 'expense' ? 'bg-yellow-400' : 'bg-gray-100'}`}>支出</button>
        <button onClick={() => setType('income')} className={`flex-1 py-1 rounded text-sm ${type === 'income' ? 'bg-yellow-400' : 'bg-gray-100'}`}>收入</button>
      </div>
      <input placeholder="名称" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 rounded text-sm" />
      <input placeholder="金额（元）" value={amount} type="number" onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 bg-gray-50 rounded text-sm" />
      <select value={catId} onChange={e => setCatId(e.target.value)} className="w-full px-3 py-2 bg-gray-50 rounded text-sm">
        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </select>
      <div className="flex gap-2">
        <button onClick={async () => {
          const a = parseFloat(amount); if (!name || !a) return
          await onAdd({ name, amount: Math.round(a * 100), type, categoryId: catId, accountId: 'wechat', note: name })
          setName(''); setAmount(''); setShow(false)
        }} className="flex-1 py-2 bg-yellow-400 rounded text-sm font-medium">保存</button>
        <button onClick={() => setShow(false)} className="px-4 py-2 bg-gray-100 rounded text-sm">取消</button>
      </div>
    </div>
  )
}
