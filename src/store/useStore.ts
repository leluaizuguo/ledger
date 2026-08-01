import { create } from 'zustand'
import { Bill, Account, Category, BillTemplate, RecurringBill, Installment } from '../types'
import { getCurrentMonth } from '../utils/format'
import {
  getBillsByMonth, addBill, deleteBill, getAccounts,
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
  loadBills: () => Promise<void>
  addBillRecord: (b: Omit<Bill, 'id' | 'createdAt' | 'client_id' | 'user_id'>) => Promise<number>
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
  loadBills: async () => {
    const { currentMonth, searchQuery } = get()
    const bills = searchQuery ? await searchBills(searchQuery, currentMonth) : await getBillsByMonth(currentMonth)
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
  currentUser: null,
  deviceId: getDeviceId(),
  initSync: () => {
    setStatusListener((status, message) => { set({ syncStatus: status, syncMessage: message || '' }) })
    const getLocalBills = async () => await getAllBills()
    const saveRemote = async (remoteBills: Bill[]) => {
      for (const rb of remoteBills) {
        const existing = await db.bills.where('client_id').equals(rb.client_id).first()
        if (existing) {
          if (!existing.updatedAt || (rb.updatedAt && rb.updatedAt > existing.updatedAt)) {
            await db.bills.update(existing.id!, { ...rb, id: existing.id })
          }
        } else {
          await db.bills.add(rb)
        }
      }
      await get().loadBills()
      get().triggerRefresh()
    }
    startSync(getLocalBills, saveRemote)
  },
  teardownSync: () => { stopSync() },
  loadUser: () => { const u = getUser(); set({ currentUser: u }) },
}))
