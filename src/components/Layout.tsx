import { useState, useCallback, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { recordAndRecognize } from '../utils/volcengine'
import { parseVoiceTextMulti } from '../utils/voice'
import { useStore } from '../store/useStore'
import { getTodayISO } from '../utils/format'
import { logout, getGroup } from '../utils/api'

const tabs = [
  { path: '/record',   label: '记账', icon: '✏️' },
  { path: '/bills',    label: '账单', icon: '📋' },
  { path: '/calendar', label: '日历', icon: '📅' },
  { path: '/chart',    label: '图表', icon: '📊' },
  { path: '/accounts', label: '资产', icon: '💼' },
]

export default function Layout() {
  const location = useLocation()
  const { addBillRecord, expenseCategories, incomeCategories, syncStatus, currentUser, loadUser, initSync, teardownSync, loadCustomCats } = useStore()
  const [isListening, setIsListening] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [shakeOn, setShakeOn] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('dark') === '1')
  const shakeLock = useRef(false)
  const [searchParams] = useSearchParams()

  // 深色模式同步
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('dark', dark ? '1' : '0')
  }, [dark])

  // V4: 加载用户 + 启动同步
  useEffect(() => { loadUser(); initSync(); loadCustomCats(); return () => teardownSync() }, [])

  // URL 参数自动记账 (如 ?amount=25&note=午餐)
  useEffect(() => {
    const amount = searchParams.get('amount')
    const note = searchParams.get('note') || ''
    const type = searchParams.get('type') || 'expense'
    if (!amount) return

    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) return

    const results = parseVoiceTextMulti(note || `金额 ${amount}元`)
    const r = results[0]
    addBillRecord({
      amount: Math.round(num * 100),
      type: type as 'expense' | 'income',
      categoryId: r.categoryId || 'other_exp',
      accountId: 'wechat',
      note: note || `快捷记账 ¥${num}`,
      date: getTodayISO(),
    }).then(() => {
      setVoiceText(`已记录：${note || ('¥' + num)}`)
    })
  }, [searchParams])

  const doRecognize = useCallback(async () => {
    if (isListening) return
    setIsListening(true)
    setVoiceText('正在听...')
    setVoiceError('')
    try {
      const text = await recordAndRecognize()
      setVoiceText(text)
      const results = parseVoiceTextMulti(text)
      let saved = 0
      for (const r of results) {
        if (r.amount && r.categoryId) {
          await addBillRecord({
            amount: r.amount, type: r.type, categoryId: r.categoryId,
            accountId: 'wechat', note: r.note || text, date: getTodayISO(),
          })
          saved++
        }
      }
      if (saved > 0) setVoiceText(`已记录 ${saved} 笔：${text}`)
      else setVoiceText(`识别结果：${text}（未能解析）`)
    } catch (err: any) {
      setVoiceError(err.message || '识别失败')
    } finally {
      setIsListening(false)
    }
  }, [addBillRecord, expenseCategories, incomeCategories, isListening])

  // 摇一摇监听
  useEffect(() => {
    if (!shakeOn) return

    let lastX = 0, lastY = 0, lastZ = 0
    let lastShake = 0

    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity
      if (!acc || !acc.x || !acc.y || !acc.z) return

      const now = Date.now()
      const deltaX = Math.abs(acc.x - lastX)
      const deltaY = Math.abs(acc.y - lastY)
      const deltaZ = Math.abs(acc.z - lastZ)
      lastX = acc.x; lastY = acc.y; lastZ = acc.z

      const shake = deltaX + deltaY + deltaZ
      if (shake > 25 && now - lastShake > 3000 && !shakeLock.current) {
        lastShake = now
        shakeLock.current = true
        setVoiceText('摇一摇触发记账 🎤')
        doRecognize().finally(() => { shakeLock.current = false })
      }
    }

    window.addEventListener('devicemotion', handler)
    return () => window.removeEventListener('devicemotion', handler)
  }, [shakeOn, doRecognize])

  // iOS 需要主动请求权限
  const enableShake = () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      (DeviceMotionEvent as any).requestPermission().then((state: string) => {
        if (state === 'granted') setShakeOn(true)
      }).catch(() => {})
    } else {
      setShakeOn(!shakeOn)
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-white dark:bg-gray-900 max-w-lg mx-auto">
      {/* V4: sync status + user */}
      <div className="flex items-center justify-between px-4 pt-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
            syncStatus === 'error' ? 'bg-red-400' : 'bg-green-400'
          }`} />
          <span className="text-xs text-gray-400">{syncStatus === 'syncing' ? '同步中' : syncStatus === 'error' ? '失败' : '在线'}</span>
        </div>
        <div className="flex items-center gap-2">
          {currentUser && <span className="text-xs text-gray-500">{currentUser.display_name}</span>}
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500">退出</button>
        </div>
      </div>
      {/* Group info */}
      {(() => { const g = getGroup(); return g ? (
        <div className="flex items-center justify-between px-4 pb-1 shrink-0">
          <span className="text-xs text-gray-400">{g.name} · {g.members.length}人</span>
          <button onClick={() => { navigator.clipboard.writeText(g.invite_code); alert('邀请码已复制: ' + g.invite_code) }}
            className="text-xs text-blue-400 hover:text-blue-600">邀请码: {g.invite_code}</button>
        </div>
      ) : null })()}

      {(voiceText || voiceError) && (
        <div className={`mx-4 mt-2 px-3 py-2 rounded-lg text-sm text-center shrink-0 ${
          voiceError ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
        }`}>
          {isListening ? '🎙️ ' : ''}{voiceError || voiceText}
        </div>
      )}

      {/* 摇一摇和暗色模式 */}
      <div className="flex justify-center gap-2 shrink-0">
        <button onClick={enableShake}
          className={`text-xs px-3 py-0.5 rounded-full mt-1 ${shakeOn ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
          {shakeOn ? '📳 已开启' : '📳 摇一摇'}
        </button>
        <button onClick={() => setDark(!dark)}
          className={`text-xs px-3 py-0.5 rounded-full mt-1 bg-gray-100 dark:bg-gray-800 text-gray-400`}>
          {dark ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="flex-1 overflow-auto relative">
        <Outlet />
      </div>

      <nav className="flex border-t border-gray-100 bg-white pb-3 pt-1 shrink-0">
        {tabs.map((tab) => {
          const active = location.pathname.startsWith(tab.path)
          if (tab.path === '/chart') {
            return (
              <>
                <button key="voice" onClick={doRecognize} disabled={isListening}
                  className={`flex-1 flex flex-col items-center py-1 text-xs gap-0.5 ${
                    isListening ? 'text-red-500' : 'text-gray-400'
                  }`}>
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

      <div className="text-center text-xs text-gray-300 pb-1 shrink-0">v{__APP_VERSION__}</div>
    </div>
  )
}
