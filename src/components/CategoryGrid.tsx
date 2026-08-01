import { useState } from 'react'
import { Category } from '../types'

interface Props {
  categories: Category[]
  selected: string | null
  onSelect: (id: string) => void
  customCategories?: Category[]
  onAddCustom?: (name: string, icon: string, type: 'expense' | 'income') => void
  onDeleteCustom?: (id: string) => void
  billType: 'expense' | 'income'
}

export default function CategoryGrid({ categories, selected, onSelect, customCategories, onAddCustom, onDeleteCustom, billType }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📌')

  const handleAdd = () => {
    if (!newName.trim() || !onAddCustom) return
    onAddCustom(newName.trim(), newIcon, billType)
    setNewName('')
    setNewIcon('📌')
    setShowForm(false)
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors relative ${
              selected === cat.id
                ? 'bg-yellow-100 ring-2 ring-yellow-400'
                : 'hover:bg-gray-50 active:bg-gray-100'
            }`}
            onContextMenu={(e) => {
              if (onDeleteCustom && customCategories?.some(c => c.id === cat.id)) {
                e.preventDefault()
                const cc = customCategories.find(c => c.id === cat.id)
                if (cc && confirm(`删除自定义分类 "${cat.name}"？`)) {
                  onDeleteCustom(cc.id)
                }
              }
            }}
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-xs text-gray-600">{cat.name}</span>
            {customCategories?.some(c => c.id === cat.id) && (
              <span className="absolute -top-1 -right-1 text-xs text-red-400">✕</span>
            )}
          </button>
        ))}

        {/* Add custom category button */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex flex-col items-center gap-1 py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600"
        >
          <span className="text-2xl">+</span>
          <span className="text-xs">自定义</span>
        </button>
      </div>

      {showForm && (
        <div className="mt-3 p-3 bg-gray-50 rounded-xl flex items-center gap-2">
          <input
            type="text" value={newIcon} onChange={e => setNewIcon(e.target.value)}
            className="w-12 text-center text-xl border rounded-lg px-1 py-1 bg-white"
            maxLength={2}
            placeholder="图标"
          />
          <input
            type="text" value={newName} onChange={e => setNewName(e.target.value)}
            className="flex-1 border rounded-lg px-2 py-1 bg-white text-sm"
            placeholder="分类名称"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd}
            className="px-3 py-1 bg-yellow-400 text-sm rounded-lg font-medium">
            添加
          </button>
          <button onClick={() => setShowForm(false)}
            className="px-3 py-1 bg-gray-200 text-sm rounded-lg">
            取消
          </button>
        </div>
      )}
    </div>
  )
}
