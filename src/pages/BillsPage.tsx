import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import BillItem from '../components/BillItem'
import { getMonthKey } from '../utils/format'
import { exportJSON, importJSON, exportCSV } from '../utils/export'
import { parseVoiceTextMulti } from '../utils/voice'

export default function BillsPage() {
  const { bills, currentMonth, loadBills, setCurrentMonth, searchQuery, setSearchQuery, addBillRecord, removeBill } = useStore()
  const [textImport, setTextImport] = useState(false)
  const [textContent, setTextContent] = useState('')
  const [preview, setPreview] = useState<{ note: string; amount: string; cat: string; ok: boolean }[]>([])
  const [importing, setImporting] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => { loadBills() }, [currentMonth, searchQuery, loadBills])

  const grouped: Record<string, typeof bills> = {}
  for (const b of bills) {
    const key = getMonthKey(b.date)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(b)
  }

  const monthTotal = bills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
  const monthIncome = bills.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleBatchDelete = async () => {
    if (!confirm(`删除 ${selectedIds.size} 条账单？`)) return
    for (const id of selectedIds) await removeBill(id)
    setSelectedIds(new Set())
    setBatchMode(false)
    loadBills()
  }

  const handleTextChange = (val: string) => {
    setTextContent(val)
    const lines = val.split('\n').filter(l => l.trim())
    const items = lines.map(line => {
      const results = parseVoiceTextMulti(line)
      const r = results[0]
      return { note: line.trim(), amount: r.amount ? `¥${(r.amount / 100).toFixed(2)}` : '—', cat: r.categoryId || '—', ok: !!(r.amount && r.categoryId) }
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
          await addBillRecord({ amount: r.amount, type: r.type, categoryId: r.categoryId, accountId: 'wechat', note: line.trim(), date: currentMonth + '-01' })
          count++
        }
      }
    }
    setImporting(false); setTextImport(false); setTextContent('')
    alert(`已导入 ${count} 条账单`)
    loadBills()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex gap-2">
          <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)}
            className="text-lg font-bold bg-transparent outline-none flex-1 dark:text-white" />
          <button onClick={exportJSON} className="text-xs text-yellow-600 px-3 py-1 rounded-full bg-yellow-50 active:bg-yellow-100">JSON</button>
          <button onClick={exportCSV} className="text-xs text-green-600 px-3 py-1 rounded-full bg-green-50 active:bg-green-100">CSV</button>
          <button onClick={() => setTextImport(true)} className="text-xs text-blue-600 px-3 py-1 rounded-full bg-blue-50 active:bg-blue-100">文本</button>
          <label className="text-xs text-gray-500 px-3 py-1 rounded-full bg-gray-50 active:bg-gray-100 cursor-pointer">
            导入<input type="file" accept=".json" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const c = await importJSON(f); alert(`导入 ${c} 条`); loadBills() } catch { alert('格式错误') } }} />
          </label>
        </div>
        <div className="flex gap-4 mt-2 text-sm">
          <span>支出 <span className="font-semibold text-red-500">¥{(monthTotal / 100).toFixed(2)}</span></span>
          <span>收入 <span className="font-semibold text-green-500">¥{(monthIncome / 100).toFixed(2)}</span></span>
          <span>结余 <span className="font-semibold dark:text-gray-300">¥{((monthIncome - monthTotal) / 100).toFixed(2)}</span></span>
        </div>
        <div className="flex gap-2 mt-2">
          <input type="search" placeholder="搜索账单..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-lg text-sm outline-none" />
          <button onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()) }}
            className={`text-xs px-3 py-1 rounded-full ${batchMode ? 'bg-red-100 text-red-600' : 'bg-gray-50 dark:bg-gray-800 text-gray-400'}`}>
            {batchMode ? '取消' : '批量'}
          </button>
        </div>
        {batchMode && selectedIds.size > 0 && (
          <button onClick={handleBatchDelete} className="mt-2 w-full py-1.5 bg-red-500 text-white rounded-lg text-sm">
            删除 {selectedIds.size} 条
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {bills.length === 0 ? (
          <div className="text-center text-gray-400 mt-20 dark:text-gray-600">{searchQuery ? '没有匹配的账单' : '还没有账单，去记一笔吧'}</div>
        ) : (
          Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
            .map(([month, items]) => (
              <div key={month}>
                <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 dark:text-gray-500">{parseInt(month.slice(5))}月</div>
                {items.map(b => (
                  <div key={b.id} className="flex items-center">
                    {batchMode && (
                      <input type="checkbox" checked={selectedIds.has(b.id!)} onChange={() => toggleSelect(b.id!)}
                        className="ml-3 w-4 h-4 accent-yellow-400" />
                    )}
                    <div className="flex-1"><BillItem bill={b} /></div>
                  </div>
                ))}
              </div>
            ))
        )}
      </div>

      {textImport && (
        <div className="absolute inset-0 z-20 bg-black/30 flex items-center justify-center p-4" onClick={() => setTextImport(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b dark:border-gray-800 font-semibold dark:text-white">文本导入</div>
            <div className="p-4 flex-1 overflow-auto">
              <textarea value={textContent} onChange={e => handleTextChange(e.target.value)}
                placeholder={`粘贴账单文本，每行一条：\n午餐 25元\n坐地铁 6块\n买咖啡 15`}
                className="w-full h-24 px-3 py-2 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-lg text-sm outline-none resize-none" autoFocus />
              {preview.length > 0 && (
                <div className="mt-3 text-xs">
                  <div className="text-gray-400 mb-1">识别预览：</div>
                  <div className="max-h-40 overflow-auto space-y-1">
                    {preview.map((p, i) => (
                      <div key={i} className={`flex justify-between px-2 py-1 rounded ${p.ok ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                        <span className="truncate flex-1 dark:text-gray-300">{p.note}</span>
                        <span className="ml-2 shrink-0">{p.amount} {p.cat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t dark:border-gray-800 flex gap-2">
              <button onClick={handleImport} disabled={importing || preview.filter(p => p.ok).length === 0}
                className="flex-1 py-2 bg-yellow-400 rounded-lg text-sm font-medium disabled:opacity-30">
                {importing ? '导入中...' : `导入 ${preview.filter(p => p.ok).length} 条`}
              </button>
              <button onClick={() => setTextImport(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-lg text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
