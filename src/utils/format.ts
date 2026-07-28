export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2)
}

export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100)
}

export function formatMoney(fen: number): string {
  if (fen === 0) return '¥0.00'
  const yuan = Math.abs(fen) / 100
  const sign = fen < 0 ? '-' : ''
  return `${sign}¥${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function getMonthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
