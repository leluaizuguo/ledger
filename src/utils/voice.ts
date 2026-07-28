import { Category } from '../types'

// 语音识别结果解析
export interface VoiceResult {
  amount: number | null    // 分
  type: 'expense' | 'income'
  categoryId: string | null
  note: string
  raw: string
}

// 关键词 → 分类映射
const KEYWORD_CATEGORY_MAP: Record<string, { catId: string; type: 'expense' | 'income' }> = {
  // 支出
  '饭|餐|吃|外卖|食堂|早餐|午餐|晚饭|夜宵|烧烤|火锅|奶茶|咖啡|饮料|水果|零食|买菜': { catId: 'food', type: 'expense' },
  '地铁|公交|打车|滴滴|高铁|火车|机票|油费|加油|停车|高速|过路费|共享单车|骑行|打车费|交通': { catId: 'transport', type: 'expense' },
  '买|淘宝|京东|拼多多|衣服|鞋|包|日用品|超市|商场|购物': { catId: 'shopping', type: 'expense' },
  '电影|游戏|KTV|唱歌|演出|门票|旅游|酒店|景点|玩乐|娱乐': { catId: 'entertain', type: 'expense' },
  '房租|物业|水电|电费|水费|煤气|天然气|房贷|住房|网费|宽带': { catId: 'housing', type: 'expense' },
  '药|医院|挂号|看病|体检|牙科|医疗|保险': { catId: 'medical', type: 'expense' },
  '书|课程|培训|学费|考试|学习|教育': { catId: 'education', type: 'expense' },
  '手机|电脑|耳机|充电器|数据线|数码|电子': { catId: 'digital', type: 'expense' },
  '理发|护肤|化妆|面膜|美容|美甲|发型|烫发': { catId: 'beauty', type: 'expense' },
  '猫|狗|宠物|猫粮|狗粮|猫砂|疫苗|驱虫': { catId: 'pet', type: 'expense' },
  '红包|送礼|礼物|结婚|份子钱|请客|人情': { catId: 'gift', type: 'expense' },
  // 收入
  '工资|发薪|薪水|收入|到账': { catId: 'salary', type: 'income' },
  '奖金|年终奖|绩效|分红': { catId: 'bonus', type: 'income' },
  '股票|基金|理财|收益|利息|投资|赚': { catId: 'invest', type: 'income' },
  '兼职|副业|外快|接单': { catId: 'parttime', type: 'income' },
  // 退款
  '退款|退钱|报销|到账|返还|返现': { catId: 'other_inc', type: 'income' },
}

// 金额模式：数字 + 元/块/¥/美元
const AMOUNT_PATTERNS = [
  /(\d+(?:\.\d{1,2})?)\s*[元块¥]/,  // 25元, 12.5块, ¥30
  /(\d+(?:\.\d{1,2})?)\s*(?:块钱|元钱)/,
  /[花了|消费|用了|付了|花了|支出|收入|扣了]\s*(\d+(?:\.\d{1,2})?)/,
  /(\d+(?:\.\d{1,2})?)/,  // 纯数字作为 fallback
]

export function parseVoiceText(text: string, categories: Category[]): VoiceResult {
  const result: VoiceResult = {
    amount: null,
    type: 'expense',
    categoryId: null,
    note: text,
    raw: text,
  }

  // 1. 提取金额
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const amount = parseFloat(match[1])
      if (amount > 0 && amount < 100000000) {
        result.amount = Math.round(amount * 100)
        break
      }
    }
  }

  // 2. 匹配分类
  for (const [keywords, mapping] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    const regex = new RegExp(keywords)
    if (regex.test(text)) {
      result.type = mapping.type
      result.categoryId = mapping.catId
      break
    }
  }

  // 如果识别为退款等，设为收入
  if (result.type === 'income' && !text.includes('工资') && !text.includes('奖金') && !text.includes('投资')) {
    // 可能是退款，保持 income
  }

  // 3. 检查是否有收入关键词覆盖
  if (/工资|到账|收入|入账|赚了/.test(text)) {
    result.type = 'income'
  }

  return result
}

// Web Speech API 封装
export function startSpeechRecognition(
  lang: string,
  onResult: (text: string) => void,
  onError: (error: string) => void,
  onEnd: () => void,
): { stop: () => void } {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (!SpeechRecognition) {
    onError('浏览器不支持语音识别，请使用 Chrome 或 Edge')
    return { stop: () => {} }
  }

  const recognition = new SpeechRecognition()
  recognition.lang = lang
  recognition.interimResults = false
  recognition.continuous = false
  recognition.maxAlternatives = 1

  recognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript
    onResult(text)
  }

  recognition.onerror = (event: any) => {
    onError(event.error === 'not-allowed' ? '请允许麦克风权限' : `识别失败: ${event.error}`)
  }

  recognition.onend = () => {
    onEnd()
  }

  recognition.start()

  return {
    stop: () => recognition.stop(),
  }
}
