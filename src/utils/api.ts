const SK = 'lssrv'

export function getSyncServer(): string {
  return localStorage.getItem(SK) || 'http://localhost:8765'
}
export function setSyncServer(url: string): void {
  localStorage.setItem(SK, url)
}

const TK = 'lstok'
const UK = 'lsusr'
const GK = 'lsgrp'

export type GroupInfo = { id: number; name: string; invite_code: string; members: { id: number; username: string; display_name: string }[] }

export function getToken(): string | null { return localStorage.getItem(TK) }
export function setToken(t: string): void { localStorage.setItem(TK, t) }
export function clearToken(): void { localStorage.removeItem(TK); localStorage.removeItem(UK); localStorage.removeItem(GK) }

export function getUser(): { id: number; username: string; display_name: string } | null {
  const r = localStorage.getItem(UK); if (!r) return null
  try { return JSON.parse(r) } catch { return null }
}
export function setUser(u: { id: number; username: string; display_name: string }): void { localStorage.setItem(UK, JSON.stringify(u)) }

export function getGroup(): GroupInfo | null {
  const r = localStorage.getItem(GK); if (!r) return null
  try { return JSON.parse(r) } catch { return null }
}
export function setGroup(g: GroupInfo): void { localStorage.setItem(GK, JSON.stringify(g)) }

export function isLoggedIn(): boolean { return !!getToken() && !!getUser() }
export function logout(): void { clearToken(); window.location.hash = '#/login' }

async function api(p: string, o: RequestInit = {}): Promise<any> {
  const t = getToken()
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}) }
  if (t) h['Authorization'] = 'Bearer ' + t
  const r = await fetch(getSyncServer() + p, { ...o, headers: h })
  const d = await r.json()
  if (!r.ok) { if (r.status === 401) { clearToken(); window.location.hash = '#/login' }; throw new Error(d.detail || 'API error ' + r.status) }
  return d
}

export async function register(u: string, n: string, pw: string, invite = '') {
  return api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: u, display_name: n, password: pw, invite_code: invite }) })
}
export async function login(u: string, pw: string) {
  return api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: pw }) })
}
export async function fetchMe() { return api('/api/auth/me') }
export async function fetchGroup() { return api('/api/groups/info') }

export type SyncBill = { client_id: string; amount: number; type: string; category_id: string; account_id: string; target_account_id?: string; note: string; date: string; is_reimbursable: boolean; reimbursed: boolean; installment_id?: number; image_data?: string; updated_at: number }
export async function pushBills(did: string, bills: SyncBill[]) { return api('/api/sync/push', { method: 'POST', body: JSON.stringify({ device_id: did, bills }) }) }
export async function pullBills(since: number, did: string) { return api('/api/sync/pull?since=' + since + '&device_id=' + did) }
export async function healthCheck(): Promise<boolean> { try { const r = await fetch(getSyncServer() + '/api/health'); return r.ok } catch { return false } }
