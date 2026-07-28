export interface Bill {
  id?: number
  amount: number
  type: 'expense' | 'income'
  categoryId: string
  note: string
  date: string
  createdAt: number
}

export interface Category {
  id: string
  name: string
  icon: string
  type: 'expense' | 'income'
  parentId?: string
}

export interface MonthStats {
  totalExpense: number
  totalIncome: number
  balance: number
  categoryBreakdown: {
    categoryId: string
    name: string
    icon: string
    amount: number
    percent: number
  }[]
}
