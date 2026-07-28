import { create } from 'zustand'
import { Bill, Account, Category } from '../types'
import { getCurrentMonth } from '../utils/format'
import { getBillsByMonth, addBill, deleteBill, getAccounts, searchBills, getBudget, setBudget } from '../db'
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

  expenseCategories: Category[]
  incomeCategories: Category[]

  refreshKey: number
  triggerRefresh: () => void
}

export const useStore = create<LedgerState>((set, get) => ({
  currentMonth: getCurrentMonth(),
  setCurrentMonth: (m) => set({ currentMonth: m }),

  bills: [],
  loadBills: async () => {
    const { currentMonth, searchQuery } = get()
    const bills = searchQuery
      ? await searchBills(searchQuery, currentMonth)
      : await getBillsByMonth(currentMonth)
    set({ bills })
  },
  addBillRecord: async (bill) => {
    const id = await addBill(bill)
    await get().loadBills()
    await get().loadAccounts()
    get().triggerRefresh()
    return id
  },
  removeBill: async (id) => {
    await deleteBill(id)
    await get().loadBills()
    await get().loadAccounts()
    get().triggerRefresh()
  },

  accounts: [],
  loadAccounts: async () => {
    const accounts = await getAccounts()
    set({ accounts })
  },

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  budget: null,
  loadBudget: async () => {
    const { currentMonth } = get()
    const b = await getBudget(currentMonth)
    set({ budget: b?.amount ?? null })
  },
  saveBudget: async (amount) => {
    const { currentMonth } = get()
    await setBudget(currentMonth, amount)
    set({ budget: amount })
  },

  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  incomeCategories: DEFAULT_INCOME_CATEGORIES,

  refreshKey: 0,
  triggerRefresh: () => set(s => ({ refreshKey: s.refreshKey + 1 })),
}))
