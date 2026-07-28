export interface Bill {
  id?: number
  amount: number
  type: 'expense' | 'income' | 'transfer_out' | 'transfer_in'
  categoryId: string
  accountId: string         // 新增：关联账户
  targetAccountId?: string  // 转账目标账户
  note: string
  date: string
  createdAt: number
}

export interface Account {
  id: string                // 如 'cash', 'bank'
  name: string              // 如 '现金', '储蓄卡'
  icon: string              // emoji
  type: 'cash' | 'bank' | 'credit' | 'ewallet' | 'invest'
  balance: number           // 余额（分）
  createdAt: number
}

export interface Budget {
  id?: number
  month: string             // '2026-07'
  categoryId: string | null // null = 总预算
  amount: number            // 预算金额（分）
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
