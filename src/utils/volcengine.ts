// 语音识别 — transformers.js Whisper 模型
// 浏览器端运行，首次加载需下载模型（~150MB，走国内镜像）

import { pipeline, env } from '@huggingface/transformers'

// 国内 HuggingFace 镜像，避免被墙
env.remoteHost = 'https://hf-mirror.com'
env.allowLocalModels = false

let transcriber: any = null
let loading = false

async function getTranscriber() {
  if (transcriber) return transcriber
  if (loading) {
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
