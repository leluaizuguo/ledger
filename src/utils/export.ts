import { getAllBills, db } from '../db'

export async function exportJSON(): Promise<void> {
  const bills = await getAllBills()
  const json = JSON.stringify(bills, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importJSON(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const bills = JSON.parse(e.target?.result as string)
        if (!Array.isArray(bills)) throw new Error('格式错误')
        let count = 0
        for (const b of bills) {
          await db.bills.add({
            amount: b.amount,
            type: b.type,
            categoryId: b.categoryId,
            accountId: b.accountId || 'cash',
            note: b.note || '',
            date: b.date,
            createdAt: Date.now(),
          })
          count++
        }
        resolve(count)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsText(file)
  })
}
