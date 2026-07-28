import { create } from 'zustand'
import { Bill, Category } from '../types'
import { getCurrentMonth } from '../utils/format'
import { getBillsByMonth, addBill, deleteBill } from '../db'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../data/categories'

interface LedgerState {
  currentMonth: string
  setCurrentMonth: (month: string) => void

  bills: Bill[]
  loadBills: () => Promise<void>
  addBillRecord: (bill: Omit<Bill, 'id' | 'createdAt'>) => Promise<number>
  removeBill: (id: number) => Promise<void>

  expenseCategories: Category[]
  incomeCategories: Category[]

  refreshKey: number
  triggerRefresh: () => void
}

export const useStore = create<LedgerState>((set, get) => ({
  currentMonth: getCurrentMonth(),
  setCurrentMonth: (month) => set({ currentMonth: month }),

  bills: [],
  loadBills: async () => {
    const month = get().currentMonth
    const bills = await getBillsByMonth(month)
    set({ bills })
  },
  addBillRecord: async (bill) => {
    const id = await addBill(bill)
    await get().loadBills()
    get().triggerRefresh()
    return id
  },
  removeBill: async (id) => {
    await deleteBill(id)
    await get().loadBills()
    get().triggerRefresh()
  },

  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  incomeCategories: DEFAULT_INCOME_CATEGORIES,

  refreshKey: 0,
  triggerRefresh: () => set(s => ({ refreshKey: s.refreshKey + 1 })),
}))
