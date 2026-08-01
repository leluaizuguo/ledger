import { useState } from 'react'
import { yuanToFen } from '../utils/format'

interface Props {
  onConfirm: (amountFen: number) => void
}

export default function AmountInput({ onConfirm }: Props) {
  const [input, setInput] = useState('0')

  const handleTap = (key: string) => {
    if (key === '⌫') {
      setInput(prev => prev.length <= 1 ? '0' : prev.slice(0, -1))
      return
    }
    if (key === '.') {
      if (input.includes('.')) return
      setInput(prev => prev + '.')
      return
    }
    setInput(prev => prev === '0' ? key : prev + key)
  }

  const displayAmount = (() => {
    const n = parseFloat(input)
    if (isNaN(n)) return '0.00'
    return n.toFixed(2)
  })()

  const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫']

  return (
    <div className="px-4 pt-6">
      <div className="text-center mb-6">
        <span className="text-5xl font-bold tracking-tight">
          ¥{displayAmount}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {keys.map(k => (
          <button
            key={k}
            onClick={() => handleTap(k)}
            className="py-4 text-xl rounded-xl active:bg-gray-100 select-none font-medium"
          >
            {k}
          </button>
        ))}
      </div>

      <button
        onClick={() => onConfirm(yuanToFen(parseFloat(input) || 0))}
        disabled={parseFloat(input) === 0}
        className="w-full mt-4 py-3 bg-yellow-400 text-black font-semibold rounded-xl
                   disabled:opacity-30 active:bg-yellow-500 transition-colors"
      >
        记一笔
      </button>
    </div>
  )
}
