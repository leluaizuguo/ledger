import { useState, useCallback } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { recordAndRecognize, hasApiKey, setApiKey } from '../utils/volcengine'
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
  const navigate = useNavigate()
  const { addBillRecord, expenseCategories, incomeCategories } = useStore()
  const [isListening, setIsListening] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [voiceError, setVoiceError] = useState('')

  const handleVoice = useCallback(async () => {
    if (!hasApiKey()) {
      setVoiceError('请先设置 API Key')
      setShowSettings(true)
      return
    }

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
          amount: result.amount,
          type: result.type,
          categoryId: result.categoryId,
          accountId: 'wechat',
          note: text,
          date: getTodayISO(),
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
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
        <span className="text-sm font-medium text-gray-500">记账</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleVoice}
            disabled={isListening}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 active:bg-yellow-100'
            }`}
          >
            🎤
          </button>
          <button
            onClick={() => {
              setApiKeyInput(hasApiKey() ? '••••••••' : '')
              setShowSettings(true)
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm bg-gray-100 text-gray-400 active:bg-gray-200"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* 语音状态提示 */}
      {(voiceText || voiceError) && (
        <div className={`mx-4 mt-2 px-3 py-2 rounded-lg text-sm text-center shrink-0 ${
          voiceError ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
        }`}>
          {isListening ? '🎙️ ' : ''}{voiceError || voiceText}
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">设置</h3>
            <label className="text-xs text-gray-500">火山引擎 API Key</label>
            <input
              type="text"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="输入 API Key"
              className="w-full mt-1 px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">在火山引擎控制台获取，留空则使用浏览器本地识别</p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  if (apiKeyInput && apiKeyInput !== '••••••••') setApiKey(apiKeyInput)
                  setShowSettings(false)
                  setVoiceError('')
                }}
                className="flex-1 py-2 bg-yellow-400 rounded-lg text-sm font-medium"
              >
                保存
              </button>
              <button onClick={() => setShowSettings(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto relative">
        <Outlet />
      </div>
      <nav className="flex border-t border-gray-100 bg-white pb-3 pt-1 shrink-0">
        {tabs.map(tab => {
          const active = location.pathname.startsWith(tab.path)
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`flex-1 flex flex-col items-center py-1 text-xs gap-0.5 ${
                active ? 'text-yellow-500' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
