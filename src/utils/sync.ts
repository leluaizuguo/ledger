import { pushBills, pullBills, healthCheck, SyncBill, getToken, fetchGroup, setGroup } from './api'
import { Bill } from '../types'
import { popPendingDeletes } from '../db'

let syncTimer: ReturnType<typeof setInterval> | null = null
let isSyncing = false
let lastPullTime = 0
const DID = 'd' + Math.random().toString(36).slice(2, 10)
const INTERVAL = 3

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'
let onStatusChange: ((status: SyncStatus, message?: string) => void) | null = null

export function getDeviceId(): string { return DID }
export function setStatusListener(fn: (status: SyncStatus, message?: string) => void) { onStatusChange = fn }
function setStatus(status: SyncStatus, message?: string) { onStatusChange?.(status, message) }

let syncCount = 0

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
      // Push all local bills (full sync — eliminates clock-skew bugs)
      const pushStartTime = Date.now() / 1000  // snapshot before push, to protect newly-added bills from deletion
      const localBills = await getLocalBills()
      const deletedIds = popPendingDeletes()
      const sb: SyncBill[] = localBills.map(b => ({
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
      await pushBills(DID, sb, deletedIds)

      // Pull (full sync — server is source of truth)
      const result = await pullBills(lastPullTime, DID)

      // Delete local bills that no longer exist on server
      // BUT skip bills added/modified after pushStartTime — they were created
      // between push and pull and haven't reached the server yet (race condition fix)
      const serverIds = new Set((result.bills || []).map((b: any) => b.client_id))
      const allLocal = await getLocalBills()
      const db = (await import('../db')).db
      const toDelete: string[] = []
      for (const b of allLocal) {
        if (b.client_id && !serverIds.has(b.client_id)) {
          // Skip bills added/modified during this sync cycle — they'll be pushed next time
          if (b.updatedAt && b.updatedAt >= pushStartTime) continue
          toDelete.push(b.client_id.slice(0,8) + ':' + (b.note||'').slice(0,8))
          await db.bills.delete(b.id!)
        }
      }
      // Debug log
      const debug = {
        push: sb.length,
        pull: (result.bills||[]).length,
        local: allLocal.length,
        deleted: toDelete,
        serverIds: Array.from(serverIds).map((s:any) => s ? s.slice(0,8) : 'NULL'),
        localIds: allLocal.map(b => (b.client_id||'').slice(0,8))
      };
      (window as any).__syncDebug = debug;
      if (toDelete.length) console.warn('SYNC DELETED BILLS', debug);

      // Upsert server bills locally
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

      // Refresh group info every sync cycle
      try {
        const g = await fetchGroup()
        if (g) setGroup(g)
      } catch { /* ignore */ }
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
