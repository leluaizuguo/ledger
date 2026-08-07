import { create } from 'zustand'
import { Bill, Account, Category, BillTemplate, RecurringBill, Installment } from '../types'
import { getCurrentMonth } from '../utils/format'
import {
  getBillsByMonth, addBill, deleteBill, updateBill, getAccounts,
  searchBills, getBudget, setBudget,
  getTemplates, saveTemplate, deleteTemplate,
  getRecurrings, saveRecurring, updateRecurring, deleteRecurring,
  getInstallments, createInstallment,
  getDueRecurrings, getAllBills, db,
  getCustomCats, addCustomCat, deleteCustomCat,
} from '../db'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../data/categories'
import { getUser } from '../utils/api'
import { startSync, stopSync, setStatusListener, SyncStatus, getDeviceId } from '../utils/sync'

function makeClientId(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

interface LedgerState {
  currentMonth: string
  setCurrentMonth: (m: string) => void
  bills: Bill[]
  foreignBills: Bill[]
  loadBills: () => Promise<void>
  addBillRecord: (b: Omit<Bill, 'id' | 'createdAt' | 'client_id' | 'user_id'>) => Promise<number>
  updateBillRecord: (id: number, changes: Partial<Bill>) => Promise<void>
  removeBill: (id: number) => Promise<void>
  accounts: Account[]
  loadAccounts: () => Promise<void>
  searchQuery: string
  setSearchQuery: (q: string) => void
  budget: number | null
  loadBudget: () => Promise<void>
  saveBudget: (amount: number) => Promise<void>
  templates: BillTemplate[]
  loadTemplates: () => Promise<void>
  addTemplate: (t: Omit<BillTemplate, 'id'>) => Promise<void>
  removeTemplate: (id: number) => Promise<void>
  recurrings: RecurringBill[]
  loadRecurrings: () => Promise<void>
  addRecurring: (r: Omit<RecurringBill, 'id'>) => Promise<void>
  toggleRecurring: (id: number, active: boolean) => Promise<void>
  removeRecurring: (id: number) => Promise<void>
  installments: Installment[]
  loadInstallments: () => Promise<void>
  addInstallment: (i: Omit<Installment, 'id'>) => Promise<void>
  expenseCategories: Category[]
  incomeCategories: Category[]
  customCategories: Category[]
  loadCustomCats: () => Promise<void>
  addCustomCat: (name: string, icon: string, type: 'expense' | 'income') => Promise<void>
  removeCustomCat: (id: string) => Promise<void>
  refreshKey: number
  triggerRefresh: () => void
  checkRecurrings: () => Promise<void>
  syncStatus: SyncStatus
  syncMessage: string
  syncConflicts: { client_id: string; local: Bill; remote: Bill }[]
  resolveConflict: (client_id: string, keep: 'local' | 'remote') => Promise<void>
  currentUser: { id: number; username: string; display_name: string } | null
  deviceId: string
  initSync: () => void
  teardownSync: () => void
  loadUser: () => void
}

export const useStore = create<LedgerState>((set, get) => ({
  currentMonth: getCurrentMonth(),
  setCurrentMonth: (m) => set({ currentMonth: m }),
  bills: [],
  foreignBills: [],
  loadBills: async () => {
    const { currentMonth, searchQuery, foreignBills, currentUser } = get()
    let bills: Bill[]
    if (searchQuery) {
      bills = await searchBills(searchQuery, currentMonth)
    } else {
      bills = await getBillsByMonth(currentMonth)
    }
    // Merge foreign bills (from server, not stored in Dexie) when logged in
    if (currentUser && foreignBills.length > 0) {
      const merged = [...bills]
      for (const fb of foreignBills) {
        if (fb.date && fb.date.startsWith(currentMonth)) {
          merged.push(fb)
        }
      }
      merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      bills = merged
    }
    set({ bills })
  },
  addBillRecord: async (bill) => {
    const user = getUser()
    const b = { ...bill, client_id: makeClientId(), user_id: user?.id || 0, updatedAt: Date.now() / 1000 }
    const id = await addBill(b)
    await get().loadBills(); await get().loadAccounts(); get().triggerRefresh()
    await get().checkRecurrings()
    return id
  },
  updateBillRecord: async (id, changes) => {
    await updateBill(id, changes)
    await get().loadBills(); await get().loadAccounts(); get().triggerRefresh()
  },
  removeBill: async (id) => {
    await deleteBill(id)
    await get().loadBills(); await get().loadAccounts(); get().triggerRefresh()
  },
  accounts: [],
  loadAccounts: async () => { set({ accounts: await getAccounts() }) },
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  budget: null,
  loadBudget: async () => { const b = await getBudget(get().currentMonth); set({ budget: b?.amount ?? null }) },
  saveBudget: async (amount) => { await setBudget(get().currentMonth, amount); set({ budget: amount }) },
  templates: [],
  loadTemplates: async () => { set({ templates: await getTemplates() }) },
  addTemplate: async (t) => { await saveTemplate(t); await get().loadTemplates() },
  removeTemplate: async (id) => { await deleteTemplate(id); await get().loadTemplates() },
  recurrings: [],
  loadRecurrings: async () => { set({ recurrings: await getRecurrings() }) },
  addRecurring: async (r) => { await saveRecurring(r); await get().loadRecurrings() },
  toggleRecurring: async (id, active) => { await updateRecurring(id, { active }); await get().loadRecurrings() },
  removeRecurring: async (id) => { await deleteRecurring(id); await get().loadRecurrings() },
  installments: [],
  loadInstallments: async () => { set({ installments: await getInstallments() }) },
  addInstallment: async (i) => { await createInstallment(i); await get().loadInstallments() },

  // Custom categories
  customCategories: [],
  loadCustomCats: async () => {
    const cats = await getCustomCats()
    set(s => ({
      customCategories: cats,
      expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES, ...cats.filter(c => c.type === 'expense')],
      incomeCategories: [...DEFAULT_INCOME_CATEGORIES, ...cats.filter(c => c.type === 'income')],
    }))
  },
  addCustomCat: async (name, icon, type) => {
    const id = 'custom_' + name + '_' + Date.now()
    await addCustomCat({ id, name, icon, type })
    await get().loadCustomCats()
  },
  removeCustomCat: async (id: string) => {
    await deleteCustomCat(id)
    await get().loadCustomCats()
  },
  checkRecurrings: async () => {
    const month = get().currentMonth
    const due = await getDueRecurrings(month)
    for (const r of due) {
      const today = new Date().getDate()
      if (today >= r.dayOfMonth) {
        await addBill({
          client_id: makeClientId(), user_id: getUser()?.id || 0,
          amount: r.amount, type: r.type, categoryId: r.categoryId,
          accountId: r.accountId, note: r.name, date: new Date().toISOString().slice(0, 10),
          updatedAt: Date.now() / 1000,
        })
        await updateRecurring(r.id!, { lastGenerated: month })
      }
    }
  },
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  incomeCategories: DEFAULT_INCOME_CATEGORIES,
  refreshKey: 0,
  triggerRefresh: () => set(s => ({ refreshKey: s.refreshKey + 1 })),
  syncStatus: 'idle',
  syncMessage: '',
  syncConflicts: [],
  resolveConflict: async (client_id, keep) => {
    const conflicts = get().syncConflicts
    const idx = conflicts.findIndex(c => c.client_id === client_id)
    if (idx < 0) return
    const { local, remote } = conflicts[idx]
    if (keep === 'local') {
      // Keep local: update local's updatedAt so it gets pushed next cycle
      await db.bills.update(local.id!, { updatedAt: Date.now() / 1000 })
    } else {
      // Keep remote: overwrite local with remote
      await db.bills.update(local.id!, { ...remote, id: local.id })
    }
    const next = [...conflicts]
    next.splice(idx, 1)
    set({ syncConflicts: next })
    await get().loadBills()
    get().triggerRefresh()
  },
  currentUser: null,
  deviceId: getDeviceId(),
  initSync: () => {
    setStatusListener((status, message) => { set({ syncStatus: status, syncMessage: message || '' }) })
    const getLocalBills = async () => await getAllBills()
    const saveRemote = async (remoteBills: Bill[]) => {
      const userId = get().currentUser?.id || 0
      const own: Bill[] = []
      const foreign: Bill[] = []
      for (const rb of remoteBills) {
        if (rb.user_id === userId) {
          own.push(rb)
        } else {
          foreign.push(rb)
        }
      }
      // Upsert own bills to Dexie, detect conflicts
      const newConflicts: { client_id: string; local: Bill; remote: Bill }[] = []
      for (const rb of own) {
        const existing = await db.bills.where('client_id').equals(rb.client_id).first()
        if (existing) {
          // Check for real data conflict (amount, type, category, account, note, date changed)
          const differs = existing.amount !== rb.amount ||
            existing.type !== rb.type ||
            existing.categoryId !== rb.categoryId ||
            existing.accountId !== rb.accountId ||
            existing.note !== rb.note ||
            existing.date !== rb.date
          if (differs && existing.updatedAt && rb.updatedAt && rb.updatedAt > existing.updatedAt) {
            // Remote is newer but data differs → conflict
            newConflicts.push({ client_id: rb.client_id!, local: { ...existing }, remote: { ...rb } })
          } else if (!differs || !existing.updatedAt || (rb.updatedAt && rb.updatedAt <= existing.updatedAt)) {
            // No conflict: data same, or local is newer, or local has no timestamp
            await db.bills.update(existing.id!, { ...rb, id: existing.id, updatedAt: existing.updatedAt || rb.updatedAt })
          }
        } else {
          await db.bills.add(rb)
        }
      }
      if (newConflicts.length > 0) {
        set(s => ({ syncConflicts: [...s.syncConflicts, ...newConflicts] }))
      }
      // Foreign bills stay in-memory only
      set({ foreignBills: foreign })
      await get().loadBills()
      get().triggerRefresh()
    }
    startSync(getLocalBills, saveRemote)
  },
  teardownSync: () => {
    stopSync()
    set({ foreignBills: [] })
  },
  loadUser: () => { const u = getUser(); set({ currentUser: u }) },
}))
