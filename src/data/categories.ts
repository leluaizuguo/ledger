import { Category } from '../types'

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  { id: 'food',      name: '餐饮',   icon: '🍔', type: 'expense' },
  { id: 'transport', name: '交通',   icon: '🚌', type: 'expense' },
  { id: 'shopping',  name: '购物',   icon: '🛒', type: 'expense' },
  { id: 'entertain', name: '娱乐',   icon: '🎮', type: 'expense' },
  { id: 'housing',   name: '住房',   icon: '🏠', type: 'expense' },
  { id: 'medical',   name: '医疗',   icon: '💊', type: 'expense' },
  { id: 'education', name: '教育',   icon: '📚', type: 'expense' },
  { id: 'digital',   name: '数码',   icon: '📱', type: 'expense' },
  { id: 'beauty',    name: '美容',   icon: '💄', type: 'expense' },
  { id: 'pet',       name: '宠物',   icon: '🐱', type: 'expense' },
  { id: 'gift',      name: '人情',   icon: '🎁', type: 'expense' },
  { id: 'other_exp', name: '其他支出', icon: '💸', type: 'expense' },
]

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: 'salary',    name: '工资',   icon: '💰', type: 'income' },
  { id: 'bonus',     name: '奖金',   icon: '🧧', type: 'income' },
  { id: 'invest',    name: '投资',   icon: '📈', type: 'income' },
  { id: 'parttime',  name: '兼职',   icon: '💼', type: 'income' },
  { id: 'other_inc', name: '其他收入', icon: '📥', type: 'income' },
]
