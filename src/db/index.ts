import Dexie, { Table } from 'dexie'
import { Bill } from '../types'

class LedgerDB extends Dexie {
  bills!: Table<Bill, number>

  constructor() {
    super('ledger')
    this.version(1).stores({
      bills: '++id, type, categoryId, date, amount, createdAt',
    })
  }
}

export const db = new LedgerDB()

export async function addBill(bill: Omit<Bill, 'id' | 'createdAt'>): Promise<number> {
  return db.bills.add({ ...bill, createdAt: Date.now() })
}

export async function getBillsByMonth(monthKey: string): Promise<Bill[]> {
  return db.bills
    .where('date')
    .startsWith(monthKey)
    .reverse()
    .sortBy('createdAt')
}

export async function deleteBill(id: number): Promise<void> {
  return db.bills.delete(id)
}

export async function updateBill(id: number, changes: Partial<Bill>): Promise<number> {
  return db.bills.update(id, changes)
}

export async function getAllBills(): Promise<Bill[]> {
  return db.bills.orderBy('createdAt').reverse().toArray()
}
