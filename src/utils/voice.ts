import { Category } from '../types'

export interface VoiceResult {
  amount: number | null
  type: 'expense' | 'income'
  categoryId: string | null
  note: string
  raw: string
}

const KEYWORD_CATEGORY_MAP: Record<string, { catId: string; type: 'expense' | 'income' }> = {
  '饭|餐|吃|外卖|食堂|早餐|午餐|晚饭|夜宵|烧烤|火锅|奶茶|咖啡|饮料|水果|零食|买菜|夜宵|便当|盒饭|盖饭|炒饭|面|粉|米线|麻辣烫|冒菜|自助|聚餐|请客吃饭': { catId: 'food', type: 'expense' },
  '地铁|公交|打车|滴滴|高铁|火车|机票|油费|加油|停车|高速|过路费|共享单车|骑行|打车费|交通|坐车|乘车|开车|代驾': { catId: 'transport', type: 'expense' },
  '买|淘宝|京东|拼多多|衣服|鞋|包|日用品|超市|商场|购物|网购|快递': { catId: 'shopping', type: 'expense' },
  '电影|游戏|KTV|唱歌|演出|门票|旅游|酒店|景点|玩乐|娱乐|洗脚|按摩|足疗': { catId: 'entertain', type: 'expense' },
  '房租|物业|水电|电费|水费|煤气|天然气|房贷|住房|网费|宽带': { catId: 'housing', type: 'expense' },
  '药|医院|挂号|看病|体检|牙科|医疗|保险': { catId: 'medical', type: 'expense' },
  '书|课程|培训|学费|考试|学习|教育': { catId: 'education', type: 'expense' },
  '手机|电脑|耳机|充电器|数据线|数码|电子': { catId: 'digital', type: 'expense' },
  '理发|护肤|化妆|面膜|美容|美甲|发型|烫发': { catId: 'beauty', type: 'expense' },
  '猫|狗|宠物|猫粮|狗粮|猫砂|疫苗|驱虫': { catId: 'pet', type: 'expense' },
  '红包|送礼|礼物|结婚|份子钱|请客|人情|随礼': { catId: 'gift', type: 'expense' },
  '工资|发薪|薪水|收入|到账': { catId: 'salary', type: 'income' },
  '奖金|年终奖|绩效|分红': { catId: 'bonus', type: 'income' },
  '股票|基金|理财|收益|利息|投资|赚': { catId: 'invest', type: 'income' },
  '兼职|副业|外快|接单': { catId: 'parttime', type: 'income' },
  '退款|退钱|报销|返还|返现': { catId: 'other_inc', type: 'income' },
}

// 金额模式
const AMOUNT_RE = /(\d+(?:\.\d{1,2})?)\s*[元块¥]|(\d+(?:\.\d{1,2})?)\s*(?:块钱|元钱)/g

function matchCategory(text: string): { catId: string; type: 'expense' | 'income' } | null {
  for (const [keywords, mapping] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    if (new RegExp(keywords).test(text)) {
      return mapping
    }
  }
  return null
}

// 单笔解析（保留兼容）
export function parseVoiceText(text: string, _categories: Category[]): VoiceResult {
  const results = parseVoiceTextMulti(text)
  return results[0] || { amount: null, type: 'expense', categoryId: null, note: text, raw: text }
}

// 多笔解析
export function parseVoiceTextMulti(text: string): VoiceResult[] {
  // 找所有金额及位置
  const matches: { amount: number; index: number; end: number; raw: string }[] = []
  let m
  while ((m = AMOUNT_RE.exec(text)) !== null) {
    const amountStr = m[1] || m[2]
    const amount = parseFloat(amountStr)
    if (amount > 0 && amount < 100000000) {
      matches.push({ amount: Math.round(amount * 100), index: m.index, end: m.index + m[0].length, raw: m[0] })
    }
  }

  if (matches.length === 0) {
    // 没有匹配到金额，尝试整段解析
    const cat = matchCategory(text)
    return [{
      amount: null, type: cat?.type || 'expense',
      categoryId: cat?.catId || null, note: text, raw: text,
    }]
  }

  if (matches.length === 1) {
    const m = matches[0]
    const prefix = text.slice(0, m.index).trim()
    const cat = matchCategory(prefix) || matchCategory(text)
    return [{
      amount: m.amount, type: cat?.type || 'expense',
      categoryId: cat?.catId || null, note: prefix || text, raw: text,
    }]
  }

  // 多笔：按金额位置切分
  const results: VoiceResult[] = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    // 当前金额前面的文本（从上一个金额之后开始）
    const start = i === 0 ? 0 : matches[i - 1].end
    const segment = text.slice(start, m.index).trim()
    const cat = matchCategory(segment)
    results.push({
      amount: m.amount,
      type: cat?.type || 'expense',
      categoryId: cat?.catId || null,
      note: segment || text,
      raw: text,
    })
  }

  return results
}

// Web Speech API
export function startSpeechRecognition(
  lang: string,
  onResult: (text: string) => void,
  onError: (error: string) => void,
  onEnd: () => void,
): { stop: () => void } {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognition) {
    onError('浏览器不支持语音识别，请使用 Edge 或 Chrome')
    return { stop: () => {} }
  }
  const recognition = new SpeechRecognition()
  recognition.lang = lang
  recognition.interimResults = false
  recognition.continuous = false
  recognition.maxAlternatives = 1
  recognition.onresult = (event: any) => {
    onResult(event.results[0][0].transcript)
  }
  recognition.onerror = (event: any) => {
    onError(event.error === 'not-allowed' ? '请允许麦克风权限' : `识别失败: ${event.error}`)
  }
  recognition.onend = () => onEnd()
  recognition.start()
  return { stop: () => recognition.stop() }
}
