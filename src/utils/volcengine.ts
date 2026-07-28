// 火山引擎豆包语音识别 — HTTP API
// API Key 鉴权 (Bearer Token)

const ASR_URL = 'https://openspeech.bytedance.com/api/v1/asr'

// 获取配置的 API Key，优先 localStorage，其次硬编码
function getApiKey(): string {
  return localStorage.getItem('volcengine_api_key') || ''
}

export function setApiKey(key: string) {
  localStorage.setItem('volcengine_api_key', key)
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0
}

// 录音 + 识别
export async function recordAndRecognize(): Promise<string> {
  const audioBlob = await recordAudio(6000)
  const base64 = await blobToBase64(audioBlob.slice(0, audioBlob.size, 'audio/wav'))

  const response = await fetch(ASR_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio: base64,
      format: 'wav',
      sample_rate: 16000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`识别失败(${response.status}): ${err}`)
  }

  const data = await response.json()
  return data.text || data.result || data.Result || ''
}

function recordAudio(maxMs: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mediaRecorder = new MediaRecorder(stream)
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = e => chunks.push(e.data)
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        resolve(new Blob(chunks))
      }

      mediaRecorder.start()
      setTimeout(() => mediaRecorder.stop(), maxMs)
    }).catch(reject)
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(blob)
  })
}
