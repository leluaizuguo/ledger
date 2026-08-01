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

export async function exportCSV(): Promise<void> {
  const bills = await getAllBills()
  const header = '日期,类型,分类,账户,金额,备注,报销\n'
  const typeMap: Record<string, string> = { expense: '支出', income: '收入', transfer_out: '转出', transfer_in: '转入' }
  const rows = bills.map(b => {
    const amount = (b.amount / 100).toFixed(2)
    const typeName = typeMap[b.type] || b.type
    const reimbursable = b.isReimbursable ? (b.reimbursed ? '已报销' : '待报销') : ''
    return `${b.date},${typeName},${b.categoryId},${b.accountId},${amount},${b.note},${reimbursable}`
  }).join('\n')
  const csv = '\uFEFF' + header + rows // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ledger-${new Date().toISOString().slice(0, 10)}.csv`
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
            client_id: b.client_id || crypto.randomUUID?.(),
            user_id: b.user_id || 0,
            amount: b.amount, type: b.type, categoryId: b.categoryId,
            accountId: b.accountId || 'cash', note: b.note || '', date: b.date,
            createdAt: Date.now(), updatedAt: Date.now() / 1000,
            isReimbursable: b.isReimbursable, reimbursed: b.reimbursed,
          })
          count++
        }
        resolve(count)
      } catch (err) { reject(err) }
    }
    reader.readAsText(file)
  })
}
