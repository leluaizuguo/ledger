import { useState } from 'react'
import { login, register, setToken, setUser, setGroup } from '../utils/api'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let result
      if (mode === 'login') {
        result = await login(username, password)
      } else {
        result = await register(username, displayName || username, password, inviteCode)
      }
      setToken(result.token)
      setUser(result.user)
      if (result.group) setGroup(result.group)
      window.location.hash = '#/record'
    } catch (err: any) {
      setError(err.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">记账</h1>
          <p className="text-gray-500 dark:text-gray-400">一家人一起记账</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
            <button type="button" onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'login' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>登录</button>
            <button type="button" onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'register' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>注册</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用户名</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoFocus
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none" required minLength={2} />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">显示名称</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="比如：乐先生" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none" required minLength={3} />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                邀请码 <span className="text-gray-400 font-normal">（可选，留空创建新圈子）</span>
              </label>
              <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="加入已有圈子请输入邀请码" maxLength={8}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none font-mono tracking-wider" />
            </div>
          )}

          {error && <div className="text-red-500 text-sm text-center">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors">
            {loading ? '请稍候...' : mode === 'login' ? '登录' : inviteCode ? '加入圈子' : '创建圈子'}
          </button>
        </form>
      </div>
    </div>
  )
}
