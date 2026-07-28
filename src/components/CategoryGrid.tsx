import { Category } from '../types'

interface Props {
  categories: Category[]
  selected: string | null
  onSelect: (id: string) => void
}

export default function CategoryGrid({ categories, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
            selected === cat.id
              ? 'bg-yellow-100 ring-2 ring-yellow-400'
              : 'hover:bg-gray-50 active:bg-gray-100'
          }`}
        >
          <span className="text-2xl">{cat.icon}</span>
          <span className="text-xs text-gray-600">{cat.name}</span>
        </button>
      ))}
    </div>
  )
}
