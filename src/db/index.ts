import Dexie, { Table } from 'dexie'
import { Bill, Account, Budget, BillTemplate, RecurringBill, Installment } from '../types'

class LedgerDB extends Dexie {
  bills!: Table<Bill, number>
  accounts!: Table<Account, string>
  budgets!: Table<Budget, number>
  templates!: Table<BillTemplate, number>
  recurrings!: Table<RecurringBill, number>
  installments!: Table<Installment, number>

  constructor() {
    super('ledger')

    this.version(3).stores({
      bills: '++id, type, categoryId, accountId, date, amount, createdAt, isReimbursable, reimbursed, installmentId',
      accounts: 'id, type',
      budgets: '++id, month, categoryId',
      templates: '++id, type',
      recurrings: '++id, active',
      installments: '++id, billId',
    }).upgrade(async tx => {
      const tCount = await tx.table('templates').count()
      if (tCount === 0) {
        await tx.table('templates').bulkAdd(DEFAULT_TEMPLATES)
      }
    })

    // V4: add client_id and user_id for sync
    this.version(4).stores({
      bills: '++id, client_id, user_id, type, categoryId, accountId, date, amount, createdAt, updatedAt',
      accounts: 'id, type',
      budgets: '++id, month, categoryId',
      templates: '++id, type',
      recurrings: '++id, active',
      installments: '++id, billId',
    }).upgrade(async tx => {
      const bills = await tx.table('bills').toArray()
      for (const b of bills) {
        if (!b.client_id) {
          const cid = crypto.randomUUID ? crypto.randomUUID() :
            'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
              const r = Math.random() * 16 | 0
              return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
            })
          await tx.table('bills').update(b.id, {
            client_id: cid,
            user_id: b.user_id || 0,
            updatedAt: b.createdAt || Date.now() / 1000,
          })
        }
      }
    })
  }
}

const DEFAULT_TEMPLATES: BillTemplate[] = [
  { name: '午餐',   amount: 2500,  type: 'expense', categoryId: 'food',    accountId: 'wechat', note: '午餐' },
  { name: '地铁通勤', amount: 600,  type: 'expense', categoryId: 'transport', accountId: 'alipay', note: '地铁' },
  { name: '咖啡',   amount: 1500,  type: 'expense', categoryId: 'food',    accountId: 'wechat', note: '咖啡' },
]

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'cash',   name: '现金',   icon: '💵', type: 'cash',    balance: 0, createdAt: Date.now() },
  { id: 'debit',  name: '储蓄卡', icon: '🏦', type: 'bank',    balance: 0, createdAt: Date.now() },
  { id: 'credit', name: '信用卡', icon: '💳', type: 'credit',  balance: 0, createdAt: Date.now() },
  { id: 'alipay', name: '支付宝', icon: '🔵', type: 'ewallet', balance: 0, createdAt: Date.now() },
  { id: 'wechat', name: '微信',   icon: '🟢', type: 'ewallet', balance: 0, createdAt: Date.now() },
]

export const db = new LedgerDB()

// === Bill helpers ===
export async function addBill(bill: Omit<Bill, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.bills.add({ ...bill, createdAt: Date.now() })
  const account = await db.accounts.get(bill.accountId)
  if (account) {
    let bc = 0
    if (bill.type === 'expense' || bill.type === 'transfer_out') bc = -bill.amount
    else if (bill.type === 'income' || bill.type === 'transfer_in') bc = bill.amount
    if (bc !== 0) await db.accounts.update(bill.accountId, { balance: account.balance + bc })
  }
  return id
}

export async function getBillsByMonth(monthKey: string): Promise<Bill[]> {
  return db.bills.where('date').startsWith(monthKey).reverse().sortBy('createdAt')
}

export async function deleteBill(id: number): Promise<void> {
  const bill = await db.bills.get(id)
  if (!bill) return
  const account = await db.accounts.get(bill.accountId)
  if (account) {
    let bc = 0
    if (bill.type === 'expense' || bill.type === 'transfer_out') bc = bill.amount
    else if (bill.type === 'income' || bill.type === 'transfer_in') bc = -bill.amount
    if (bc !== 0) await db.accounts.update(bill.accountId, { balance: account.balance + bc })
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
  if (existing) await db.budgets.update(existing.id!, { amount })
  else await db.budgets.add({ month, categoryId: null, amount })
}

// === Template helpers ===
export async function getTemplates(): Promise<BillTemplate[]> {
  return db.templates.toArray()
}
export async function saveTemplate(t: Omit<BillTemplate, 'id'>): Promise<number> {
  return db.templates.add(t)
}
export async function deleteTemplate(id: number): Promise<void> {
  return db.templates.delete(id)
}

// === Recurring helpers ===
export async function getRecurrings(): Promise<RecurringBill[]> {
  return db.recurrings.toArray()
}
export async function saveRecurring(r: Omit<RecurringBill, 'id'>): Promise<number> {
  return db.recurrings.add(r)
}
export async function updateRecurring(id: number, changes: Partial<RecurringBill>): Promise<number> {
  return db.recurrings.update(id, changes)
}
export async function deleteRecurring(id: number): Promise<void> {
  return db.recurrings.delete(id)
}
export async function getDueRecurrings(month: string): Promise<RecurringBill[]> {
  const all = await db.recurrings.where('active').equals(1).toArray()
  return all.filter(r => !r.lastGenerated || r.lastGenerated < month)
}

// === Installment helpers ===
export async function getInstallments(): Promise<Installment[]> {
  return db.installments.toArray()
}
export async function createInstallment(i: Omit<Installment, 'id'>): Promise<number> {
  return db.installments.add(i)
}
export async function updateInstallment(id: number, changes: Partial<Installment>): Promise<number> {
  return db.installments.update(id, changes)
}

// === Search ===
export async function searchBills(query: string, monthKey?: string): Promise<Bill[]> {
  let collection = db.bills.orderBy('createdAt').reverse()
  if (monthKey) collection = db.bills.where('date').startsWith(monthKey).reverse()
  const bills = await collection.toArray()
  if (!query) return bills
  const q = query.toLowerCase()
  return bills.filter(b => b.note.toLowerCase().includes(q) || b.categoryId.toLowerCase().includes(q))
}
