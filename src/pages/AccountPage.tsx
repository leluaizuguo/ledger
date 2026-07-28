import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getAccounts, updateAccountBalance } from '../db'

export default function AccountPage() {
  const { accounts, loadAccounts } = useStore()

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const handleEditBalance = async (id: string, name: string) => {
    const newBalance = prompt(`修改 ${name} 余额（元）：`)
    if (newBalance === null) return
    const fen = Math.round(parseFloat(newBalance) * 100)
    if (isNaN(fen)) return
    await updateAccountBalance(id, fen)
    await loadAccounts()
  }

  const totalBalance = accounts.reduce((s, a) => {
    if (a.type === 'credit') return s - a.balance
    return s + a.balance
  }, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <div className="text-sm text-gray-400">总资产</div>
        <div className={`text-3xl font-bold mt-1 ${totalBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          ¥{(totalBalance / 100).toFixed(2)}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {accounts.map(a => {
          const displayBalance = a.type === 'credit'
            ? `-¥${(a.balance / 100).toFixed(2)}`
            : `¥${(a.balance / 100).toFixed(2)}`
          return (
            <div key={a.id} className="flex items-center justify-between py-3 px-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <div className="font-medium text-sm">{a.name}</div>
                  <div className="text-xs text-gray-400">
                    {a.type === 'cash' ? '现金' : a.type === 'bank' ? '借记卡' : a.type === 'credit' ? '信用卡' : a.type === 'ewallet' ? '电子钱包' : '投资'}
                  </div>
                </div>
              </div>
              <button onClick={() => handleEditBalance(a.id, a.name)} className="text-sm font-semibold text-right">
                {displayBalance}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
