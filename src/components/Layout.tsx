import { useState, useCallback } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { recordAndRecognize } from '../utils/volcengine'
import { parseVoiceText } from '../utils/voice'
import { useStore } from '../store/useStore'
import { getTodayISO } from '../utils/format'

const tabs = [
  { path: '/record',   label: '记账', icon: '✏️' },
  { path: '/bills',    label: '账单', icon: '📋' },
  { path: '/chart',    label: '图表', icon: '📊' },
  { path: '/accounts', label: '资产', icon: '💼' },
]

export default function Layout() {
  const location = useLocation()
  const { addBillRecord, expenseCategories, incomeCategories } = useStore()
  const [isListening, setIsListening] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [voiceError, setVoiceError] = useState('')

  const handleVoice = useCallback(async () => {
    setIsListening(true)
    setVoiceText('正在听...')
    setVoiceError('')

    try {
      const text = await recordAndRecognize()
      setVoiceText(text)
      const allCats = [...expenseCategories, ...incomeCategories]
      const result = parseVoiceText(text, allCats)

      if (result.amount && result.categoryId) {
        await addBillRecord({
          amount: result.amount, type: result.type, categoryId: result.categoryId,
          accountId: 'wechat', note: text, date: getTodayISO(),
        })
        setVoiceText(`已记录：${text}`)
      } else {
        setVoiceText(`识别结果：${text}（未能解析金额和分类）`)
      }
    } catch (err: any) {
      setVoiceError(err.message || '识别失败')
    } finally {
      setIsListening(false)
    }
  }, [addBillRecord, expenseCategories, incomeCategories])

  return (
    <div className="flex flex-col h-dvh bg-white max-w-lg mx-auto">
      {(voiceText || voiceError) && (
        <div className={`mx-4 mt-2 px-3 py-2 rounded-lg text-sm text-center shrink-0 ${
          voiceError ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
        }`}>
          {isListening ? '🎙️ ' : ''}{voiceError || voiceText}
        </div>
      )}

      <div className="flex-1 overflow-auto relative">
        <Outlet />
      </div>

      <nav className="flex border-t border-gray-100 bg-white pb-3 pt-1 shrink-0">
        {tabs.map((tab) => {
          const active = location.pathname.startsWith(tab.path)
          if (tab.path === '/chart') {
            return (
              <>
                <button
                  key="voice"
                  onClick={handleVoice}
                  disabled={isListening}
                  className={`flex-1 flex flex-col items-center py-1 text-xs gap-0.5 ${
                    isListening ? 'text-red-500' : 'text-gray-400'
                  }`}
                >
                  <span className="text-xl">{isListening ? '🔴' : '🎤'}</span>
                  <span>语音</span>
                </button>
                <NavLink key={tab.path} to={tab.path}
                  className={`flex-1 flex flex-col items-center py-1 text-xs gap-0.5 ${
                    active ? 'text-yellow-500' : 'text-gray-400'
                  }`}>
                  <span className="text-xl">{tab.icon}</span>
                  <span>{tab.label}</span>
                </NavLink>
              </>
            )
          }
          return (
            <NavLink key={tab.path} to={tab.path}
              className={`flex-1 flex flex-col items-center py-1 text-xs gap-0.5 ${
                active ? 'text-yellow-500' : 'text-gray-400'
              }`}>
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
