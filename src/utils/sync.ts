import { pushBills, pullBills, healthCheck, SyncBill, getToken } from './api'
import { Bill } from '../types'

let syncTimer: ReturnType<typeof setInterval> | null = null
let isSyncing = false
let lastPullTime = 0
const DID = 'd' + Math.random().toString(36).slice(2, 10)
const INTERVAL = 15

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'
let onStatusChange: ((status: SyncStatus, message?: string) => void) | null = null

export function getDeviceId(): string { return DID }
export function setStatusListener(fn: (status: SyncStatus, message?: string) => void) { onStatusChange = fn }
function setStatus(status: SyncStatus, message?: string) { onStatusChange?.(status, message) }

export function startSync(
  getLocalBills: () => Promise<Bill[]>,
  saveRemoteBills: (bills: Bill[]) => Promise<void>
) {
  if (syncTimer) return

  async function doSync() {
    if (isSyncing) return
    if (!getToken()) { setStatus('idle'); return }

    const online = await healthCheck()
    if (!online) { setStatus('offline', 'Server unreachable'); return }

    isSyncing = true
    setStatus('syncing')

    try {
      // Push
      const localBills = await getLocalBills()
      const unsynced = localBills.filter(b => !b.updatedAt || b.updatedAt > lastPullTime)
      if (unsynced.length > 0) {
        const sb: SyncBill[] = unsynced.map(b => ({
          client_id: b.client_id,
          amount: b.amount,
          type: b.type,
          category_id: b.categoryId,
          account_id: b.accountId,
          target_account_id: b.targetAccountId,
          note: b.note,
          date: b.date,
          is_reimbursable: !!b.isReimbursable,
          reimbursed: !!b.reimbursed,
          installment_id: b.installmentId,
          image_data: b.imageData,
          updated_at: b.updatedAt || Date.now() / 1000,
        }))
        await pushBills(DID, sb)
      }

      // Pull
      const result = await pullBills(lastPullTime, DID)
      if (result.bills && result.bills.length > 0) {
        const remoteBills: Bill[] = result.bills.map((rb: any) => ({
          id: rb.id,
          client_id: rb.client_id,
          user_id: rb.user_id,
          display_name: rb.display_name,
          amount: rb.amount,
          type: rb.type,
          categoryId: rb.category_id,
          accountId: rb.account_id,
          targetAccountId: rb.target_account_id,
          note: rb.note,
          date: rb.date,
          createdAt: Date.now(),
          updatedAt: rb.updated_at,
          isReimbursable: rb.is_reimbursable,
          reimbursed: rb.reimbursed,
          installmentId: rb.installment_id,
          imageData: rb.image_data,
        }))
        await saveRemoteBills(remoteBills)
      }

      lastPullTime = result.server_time
      setStatus('idle')
    } catch (e: any) {
      console.error('Sync error:', e)
      setStatus('error', e.message || 'Sync failed')
    } finally {
      isSyncing = false
    }
  }

  doSync()
  syncTimer = setInterval(doSync, INTERVAL * 1000)
}

export function stopSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
}

export function triggerSyncNow(
  getLocalBills: () => Promise<Bill[]>,
  saveRemoteBills: (bills: Bill[]) => Promise<void>
) {
  lastPullTime = 0
  startSync(getLocalBills, saveRemoteBills)
}
