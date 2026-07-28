export interface Bill {
  id?: number
  amount: number
  type: 'expense' | 'income' | 'transfer_out' | 'transfer_in'
  categoryId: string
  accountId: string
  targetAccountId?: string
  note: string
  date: string
  createdAt: number
  isReimbursable?: boolean  // V3
  reimbursed?: boolean      // V3
  installmentId?: number    // V3: 关联分期
}

export interface Account {
  id: string
  name: string
  icon: string
  type: 'cash' | 'bank' | 'credit' | 'ewallet' | 'invest'
  balance: number
  createdAt: number
}

export interface Budget {
  id?: number
  month: string
  categoryId: string | null
  amount: number
}

// V3 新增
export interface BillTemplate {
  id?: number
  name: string
  amount: number
  type: 'expense' | 'income'
  categoryId: string
  accountId: string
  note: string
}

export interface RecurringBill {
  id?: number
  name: string
  amount: number
  type: 'expense' | 'income'
  categoryId: string
  accountId: string
  dayOfMonth: number       // 每月几号
  active: boolean
  lastGenerated?: string   // 上次生成月份 '2026-07'
}

export interface Installment {
  id?: number
  billId: number           // 原始消费账单 ID
  totalAmount: number
  periods: number          // 总期数
  periodAmount: number     // 每期金额
  startMonth: string       // 首期月份
  note: string
  currentPeriod: number    // 已生成期数
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
