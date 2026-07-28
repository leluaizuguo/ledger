import Dexie, { Table } from 'dexie'
import { Bill, Account, Budget } from '../types'

class LedgerDB extends Dexie {
  bills!: Table<Bill, number>
  accounts!: Table<Account, string>
  budgets!: Table<Budget, number>

  constructor() {
    super('ledger')

    this.version(2).stores({
      bills: '++id, type, categoryId, accountId, date, amount, createdAt',
      accounts: 'id, type',
      budgets: '++id, month, categoryId',
    }).upgrade(async tx => {
      // 给已有账单加默认 accountId
      const bills = await tx.table('bills').toArray()
      for (const b of bills) {
        if (!b.accountId) {
          await tx.table('bills').update(b.id!, { accountId: 'cash' })
        }
      }
      // 初始化默认账户
      const count = await tx.table('accounts').count()
      if (count === 0) {
        await tx.table('accounts').bulkAdd(DEFAULT_ACCOUNTS)
      }
    })
  }
}

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'cash',      name: '现金',   icon: '💵', type: 'cash',    balance: 0, createdAt: Date.now() },
  { id: 'debit',     name: '储蓄卡', icon: '🏦', type: 'bank',    balance: 0, createdAt: Date.now() },
  { id: 'credit',    name: '信用卡', icon: '💳', type: 'credit',  balance: 0, createdAt: Date.now() },
  { id: 'alipay',    name: '支付宝', icon: '🔵', type: 'ewallet', balance: 0, createdAt: Date.now() },
  { id: 'wechat',    name: '微信',   icon: '🟢', type: 'ewallet', balance: 0, createdAt: Date.now() },
]

export const db = new LedgerDB()

// === Bill helpers ===

export async function addBill(bill: Omit<Bill, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.bills.add({ ...bill, createdAt: Date.now() })

  // 更新账户余额
  const account = await db.accounts.get(bill.accountId)
  if (account) {
    let balanceChange = 0
    if (bill.type === 'expense' || bill.type === 'transfer_out') balanceChange = -bill.amount
    else if (bill.type === 'income' || bill.type === 'transfer_in') balanceChange = bill.amount
    if (balanceChange !== 0) {
      await db.accounts.update(bill.accountId, { balance: account.balance + balanceChange })
    }
  }

  return id
}

export async function getBillsByMonth(monthKey: string): Promise<Bill[]> {
  return db.bills.where('date').startsWith(monthKey).reverse().sortBy('createdAt')
}

export async function deleteBill(id: number): Promise<void> {
  const bill = await db.bills.get(id)
  if (!bill) return

  // 回退账户余额
  const account = await db.accounts.get(bill.accountId)
  if (account) {
    let balanceChange = 0
    if (bill.type === 'expense' || bill.type === 'transfer_out') balanceChange = bill.amount
    else if (bill.type === 'income' || bill.type === 'transfer_in') balanceChange = -bill.amount
    if (balanceChange !== 0) {
      await db.accounts.update(bill.accountId, { balance: account.balance + balanceChange })
    }
  }

  return db.bills.delete(id)
}

export async function getAllBills(): Promise<Bill[]> {
  return db.bills.orderBy('createdAt').reverse().toArray()
}

// === Account helpers ===

export async function getAccounts(): Promise<Account[]> {
  return db.accounts.toArray()
}

export async function updateAccountBalance(id: string, balance: number): Promise<number> {
  return db.accounts.update(id, { balance })
}

// === Budget helpers ===

export async function getBudget(month: string): Promise<Budget | undefined> {
  return db.budgets.where({ month, categoryId: null }).first()
}

export async function setBudget(month: string, amount: number): Promise<void> {
  const existing = await db.budgets.where({ month, categoryId: null }).first()
  if (existing) {
    await db.budgets.update(existing.id!, { amount })
  } else {
    await db.budgets.add({ month, categoryId: null, amount })
  }
}

export async function searchBills(query: string, monthKey?: string): Promise<Bill[]> {
  let collection = db.bills.orderBy('createdAt').reverse()
  if (monthKey) {
    collection = db.bills.where('date').startsWith(monthKey).reverse()
  }
  const bills = await collection.toArray()
  if (!query) return bills
  const q = query.toLowerCase()
  return bills.filter(b =>
    b.note.toLowerCase().includes(q) ||
    b.categoryId.toLowerCase().includes(q)
  )
}
