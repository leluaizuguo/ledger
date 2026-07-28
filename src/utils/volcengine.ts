// 语音识别 — Web Speech API
// Edge 走 Azure 中国直连，Chrome需要代理

type VoiceCallback = (text: string) => void
type ErrorCallback = (err: string) => void

export function startListening(
  lang: string,
  onResult: VoiceCallback,
  onError: ErrorCallback,
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
    const text = event.results[0][0].transcript
    onResult(text)
  }

  recognition.onerror = (event: any) => {
    const msg = event.error === 'not-allowed'
      ? '请允许麦克风权限'
      : event.error === 'network'
        ? '网络错误，请检查代理'
        : `识别失败: ${event.error}`
    onError(msg)
  }

  recognition.onend = () => onEnd()

  recognition.start()

  return { stop: () => recognition.stop() }
}

// 兼容 recordAndRecognize 接口（Layout 中调用）
// 返回 Promise，但实际通过 Web Speech 的流式回调处理
export function recordAndRecognize(): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stop } = startListening(
      'zh-CN',
      (text) => resolve(text),
      (err) => reject(new Error(err)),
      () => {},
    )
    // 如果10秒没结果就超时
    setTimeout(() => {
      stop()
      reject(new Error('识别超时'))
    }, 10000)
  })
}
