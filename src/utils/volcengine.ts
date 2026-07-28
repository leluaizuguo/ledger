// 语音识别 — transformers.js Whisper 模型
// 浏览器端运行，首次加载需下载模型（~150MB，后续缓存）

import { pipeline } from '@huggingface/transformers'

let transcriber: any = null
let loading = false

async function getTranscriber() {
  if (transcriber) return transcriber
  if (loading) {
    // 等待加载完成
    while (loading) await new Promise(r => setTimeout(r, 200))
    return transcriber
  }
  loading = true
  try {
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny',
      // @ts-ignore
      { quantized: true }
    )
  } finally {
    loading = false
  }
  return transcriber
}

// 录音
function recordAudio(ms: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []
      mr.ondataavailable = e => chunks.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        resolve(new Blob(chunks, { type: 'audio/webm' }))
      }
      mr.start()
      setTimeout(() => mr.stop(), ms)
    }).catch(reject)
  })
}

export async function recordAndRecognize(): Promise<string> {
  const audioBlob = await recordAudio(5000)

  const t = await getTranscriber()
  const result = await t(audioBlob, {
    language: 'zh',
    task: 'transcribe',
  })

  return (result as any).text || ''
}
