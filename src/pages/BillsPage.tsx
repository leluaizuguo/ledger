import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import BillItem from '../components/BillItem'
import { getMonthKey } from '../utils/format'
import { exportJSON, importJSON, exportCSV } from '../utils/export'
import { parseVoiceTextMulti } from '../utils/voice'

export default function BillsPage() {
  const { bills, currentMonth, loadBills, setCurrentMonth, searchQuery, setSearchQuery, addBillRecord } = useStore()
  const [textImport, setTextImport] = useState(false)
  const [textContent, setTextContent] = useState('')
  const [preview, setPreview] = useState<{ note: string; amount: string; cat: string; ok: boolean }[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => { loadBills() }, [currentMonth, searchQuery, loadBills])

  const grouped: Record<string, typeof bills> = {}
  for (const b of bills) {
    const key = getMonthKey(b.date)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  }

  const monthTotal = bills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
  const monthIncome = bills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)

  // 文本预览
  const handleTextChange = (val: string) => {
    setTextContent(val)
    const lines = val.split('\n').filter(l => l.trim())
    const items = lines.map(line => {
      const results = parseVoiceTextMulti(line)
      const r = results[0]
      return {
        note: line.trim(),
        amount: r.amount ? `¥${(r.amount / 100).toFixed(2)}` : '—',
        cat: r.categoryId || '—',
        ok: !!(r.amount && r.categoryId),
      }
    })
    setPreview(items)
  }

  const handleImport = async () => {
    setImporting(true)
    const lines = textContent.split('\n').filter(l => l.trim())
    let count = 0
    for (const line of lines) {
      const results = parseVoiceTextMulti(line)
      for (const r of results) {
        if (r.amount && r.categoryId) {
          await addBillRecord({
            amount: r.amount, type: r.type, categoryId: r.categoryId,
            accountId: 'wechat', note: line.trim(), date: currentMonth + '-01',
          })
          count++
        }
      }
    }
    setImporting(false)
    setTextImport(false)
    setTextContent('')
    alert(`已导入 ${count} 条账单`)
    loadBills()
  }

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
          <button onClick={() => setTextImport(true)}
            className="text-xs text-blue-600 px-3 py-1 rounded-full bg-blue-50 active:bg-blue-100">文本</button>
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

      {/* 文本导入弹窗 */}
      {textImport && (
        <div className="absolute inset-0 z-20 bg-black/30 flex items-center justify-center p-4" onClick={() => setTextImport(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b font-semibold">文本导入</div>
            <div className="p-4 flex-1 overflow-auto">
              <textarea
                value={textContent}
                onChange={e => handleTextChange(e.target.value)}
                placeholder={`粘贴账单文本，每行一条：\n午餐 25元\n坐地铁 6块\n买咖啡 15`}
                className="w-full h-24 px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none resize-none"
                autoFocus
              />
              {preview.length > 0 && (
                <div className="mt-3 text-xs">
                  <div className="text-gray-400 mb-1">识别预览：</div>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {preview.map((p, i) => (
                      <div key={i} className={`flex justify-between px-2 py-1 rounded ${p.ok ? 'bg-green-50' : 'bg-red-50'}`}>
                        <span className="truncate flex-1">{p.note}</span>
                        <span className="ml-2 shrink-0">{p.amount} {p.cat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={handleImport} disabled={importing || preview.filter(p => p.ok).length === 0}
                className="flex-1 py-2 bg-yellow-400 rounded-lg text-sm font-medium disabled:opacity-30">
                {importing ? '导入中...' : `导入 ${preview.filter(p => p.ok).length} 条`}
              </button>
              <button onClick={() => setTextImport(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
