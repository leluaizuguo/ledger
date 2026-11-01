import Dexie, { Table } from 'dexie'
import { Bill, Account, Budget, BillTemplate, RecurringBill, Installment, Category } from '../types'

class LedgerDB extends Dexie {
  bills!: Table<Bill, number>
  accounts!: Table<Account, string>
  budgets!: Table<Budget, number>
  templates!: Table<BillTemplate, number>
  recurrings!: Table<RecurringBill, number>
  installments!: Table<Installment, number>
  custom_cats!: Table<Category, string>
  // 圈子内其他成员的账单缓存（主键 client_id）。独立表，永不参与 push。
  foreign_bills!: Table<Bill, string>

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

    // V5: custom categories
    this.version(5).stores({
      bills: '++id, client_id, user_id, type, categoryId, accountId, date, amount, createdAt, updatedAt',
      accounts: 'id, type',
      budgets: '++id, month, categoryId',
      templates: '++id, type',
      recurrings: '++id, active',
      installments: '++id, billId',
      custom_cats: 'id, type',
    })

    // V6: 圈子账单离线缓存（他人账单落库，离线也能查看）
    this.version(6).stores({
      bills: '++id, client_id, user_id, type, categoryId, accountId, date, amount, createdAt, updatedAt',
      accounts: 'id, type',
      budgets: '++id, month, categoryId',
      templates: '++id, type',
      recurrings: '++id, active',
      installments: '++id, billId',
      custom_cats: 'id, type',
      foreign_bills: 'client_id, date, user_id, createdAt',
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
function genClientId(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

export async function addBill(bill: Omit<Bill, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.bills.add({ ...bill, client_id: genClientId(), createdAt: Date.now() })
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
  // Track deletion for sync
  if (bill.client_id) {
    const raw = localStorage.getItem('ls_del_q') || '[]'
    try {
      const q: string[] = JSON.parse(raw)
      q.push(bill.client_id)
      localStorage.setItem('ls_del_q', JSON.stringify(q))
    } catch { /* ignore */ }
  }
  return db.bills.delete(id)
}

export async function updateBill(id: number, changes: Partial<Bill>): Promise<number> {
  const old = await db.bills.get(id)
  if (!old) return 0

  // Reverse old balance effect
  const oldAccount = await db.accounts.get(old.accountId)
  if (oldAccount) {
    let bc = 0
    if (old.type === 'expense' || old.type === 'transfer_out') bc = old.amount
    else if (old.type === 'income' || old.type === 'transfer_in') bc = -old.amount
    if (bc !== 0) await db.accounts.update(old.accountId, { balance: oldAccount.balance + bc })
  }

  // Apply new balance effect
  const newAccountId = changes.accountId || old.accountId
  const newAmount = changes.amount !== undefined ? changes.amount : old.amount
  const newType = changes.type || old.type
  const newAccount = await db.accounts.get(newAccountId)
  if (newAccount) {
    let bc = 0
    if (newType === 'expense' || newType === 'transfer_out') bc = -newAmount
    else if (newType === 'income' || newType === 'transfer_in') bc = newAmount
    if (bc !== 0) await db.accounts.update(newAccountId, { balance: newAccount.balance + bc })
  }

  return db.bills.update(id, { ...changes, updatedAt: Date.now() / 1000 })
}

export function popPendingDeletes(): string[] {
  const raw = localStorage.getItem('ls_del_q') || '[]'
  try {
    const q: string[] = JSON.parse(raw)
    localStorage.removeItem('ls_del_q')
    return q
  } catch { return [] }
}

/** 只看不清 —— 网络失败时删除队列必须留着，否则这次删除就永久丢了 */
export function peekPendingDeletes(): string[] {
  const raw = localStorage.getItem('ls_del_q') || '[]'
  try { return JSON.parse(raw) } catch { return [] }
}

/** 请求成功后再移出队列。只移除本次已提交的，期间新增的保留 */
export function clearPendingDeletes(sent: string[]): void {
  if (!sent.length) return
  const raw = localStorage.getItem('ls_del_q') || '[]'
  try {
    const q: string[] = JSON.parse(raw)
    const done = new Set(sent)
    const left = q.filter(id => !done.has(id))
    if (left.length > 0) localStorage.setItem('ls_del_q', JSON.stringify(left))
    else localStorage.removeItem('ls_del_q')
  } catch { /* ignore */ }
}

export async function getAllBills(): Promise<Bill[]> {
  return db.bills.orderBy('createdAt').reverse().toArray()
}

// === Foreign (圈子成员) bill cache ===
// 他人的账单只读不推送：独立表，避免混进 getAllBills() 被 push 成自己的账单。
export async function getForeignBills(): Promise<Bill[]> {
  return db.foreign_bills.toArray()
}

/** 全量替换：pull 是全量拉取，用它保证本地缓存与服务器一致（他人删掉的账单自然消失） */
export async function replaceForeignBills(bills: Bill[]): Promise<void> {
  const rows = bills.filter(b => !!b.client_id)
  await db.transaction('rw', db.foreign_bills, async () => {
    await db.foreign_bills.clear()
    if (rows.length > 0) await db.foreign_bills.bulkPut(rows)
  })
}

/** 退圈 / 换圈子 / 登出时清空，避免看到上一个圈子的账单 */
export async function clearForeignBills(): Promise<void> {
  await db.foreign_bills.clear()
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

// === Custom Categories ===
export async function getCustomCats(): Promise<Category[]> {
  return db.custom_cats.toArray()
}
export async function addCustomCat(c: Category): Promise<string> {
  return db.custom_cats.add(c)
}
export async function deleteCustomCat(id: string): Promise<void> {
  return db.custom_cats.delete(id)
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
