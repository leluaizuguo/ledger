import { create } from 'zustand'
import { Bill, Account, Category, BillTemplate, RecurringBill, Installment } from '../types'
import { getCurrentMonth } from '../utils/format'
import {
  getBillsByMonth, addBill, deleteBill, getAccounts,
  searchBills, getBudget, setBudget,
  getTemplates, saveTemplate, deleteTemplate,
  getRecurrings, saveRecurring, updateRecurring, deleteRecurring,
  getInstallments, createInstallment,
  getDueRecurrings,
} from '../db'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../data/categories'

interface LedgerState {
  currentMonth: string
  setCurrentMonth: (m: string) => void

  bills: Bill[]
  loadBills: () => Promise<void>
  addBillRecord: (b: Omit<Bill, 'id' | 'createdAt'>) => Promise<number>
  removeBill: (id: number) => Promise<void>

  accounts: Account[]
  loadAccounts: () => Promise<void>

  searchQuery: string
  setSearchQuery: (q: string) => void

  budget: number | null
  loadBudget: () => Promise<void>
  saveBudget: (amount: number) => Promise<void>

  // V3
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

  refreshKey: number
  triggerRefresh: () => void
  checkRecurrings: () => Promise<void>
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
    const id = await addBill(bill)
    await get().loadBills(); await get().loadAccounts(); get().triggerRefresh()
    // 检查并生成周期账单
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

  // V3
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

  // 检查是否有到期周期账单需要生成
  checkRecurrings: async () => {
    const month = get().currentMonth
    const due = await getDueRecurrings(month)
    for (const r of due) {
      const today = new Date().getDate()
      if (today >= r.dayOfMonth) {
        await addBill({
          amount: r.amount, type: r.type, categoryId: r.categoryId,
          accountId: r.accountId, note: r.name, date: new Date().toISOString().slice(0, 10),
        })
        await updateRecurring(r.id!, { lastGenerated: month })
      }
    }
  },

  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  incomeCategories: DEFAULT_INCOME_CATEGORIES,

  refreshKey: 0,
  triggerRefresh: () => set(s => ({ refreshKey: s.refreshKey + 1 })),
}))
