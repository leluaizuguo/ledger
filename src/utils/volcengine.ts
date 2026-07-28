// 火山引擎豆包语音识别 — WebSocket 协议
// 新版 API Key: X-Api-Key header → URL query fallback
// 文档: https://docs.volcengine.com/docs/6561/1354869

const RESOURCE_ID = 'volc.seedasr.sauc.duration' // 豆包2.0 小时版

function getApiKey(): string { return localStorage.getItem('volcengine_api_key') || '' }
export function setApiKey(key: string) { localStorage.setItem('volcengine_api_key', key) }
export function hasApiKey(): boolean { return getApiKey().length > 0 }

// 录音并转为 PCM 16k 16bit mono
async function recordPCM(maxMs: number): Promise<Uint8Array> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
  })

  const audioCtx = new AudioContext({ sampleRate: 16000 })
  const source = audioCtx.createMediaStreamSource(stream)
  const processor = audioCtx.createScriptProcessor(4096, 1, 1)

  const chunks: Float32Array[] = []

  return new Promise((resolve) => {
    processor.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    }
    source.connect(processor)
    processor.connect(audioCtx.destination)

    setTimeout(() => {
      processor.disconnect()
      source.disconnect()
      audioCtx.close()
      stream.getTracks().forEach(t => t.stop())

      // 合并所有 chunk → 转 PCM 16bit
      const total = chunks.reduce((s, c) => s + c.length, 0)
      const pcm = new Int16Array(total)
      let offset = 0
      for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]))
          pcm[offset + i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        offset += chunk.length
      }
      resolve(new Uint8Array(pcm.buffer))
    }, maxMs)
  })
}

// WebSocket + 二进制协议识别
export async function recordAndRecognize(): Promise<string> {
  const pcmData = await recordPCM(5000)

  return new Promise((resolve, reject) => {
    const apiKey = getApiKey()
    const connectId = crypto.randomUUID()
    const requestId = crypto.randomUUID()

    // URL query 传鉴权（浏览器 WebSocket 不支持自定义 header）
    const params = new URLSearchParams({
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': RESOURCE_ID,
      'X-Api-Request-Id': requestId,
      'X-Api-Sequence': '-1',
    })
    const wsUrl = `wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async?${params}`

    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'

    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('识别超时'))
    }, 12000)

    ws.onopen = () => {
      // Full client request (JSON format)
      const request = JSON.stringify({
        user: { uid: 'ledger' },
        audio: { format: 'pcm', rate: 16000, bits: 16, channel: 1, language: 'zh-CN' },
        request: { model_name: 'bigmodel', enable_itn: true, enable_punc: true },
      })

      const payload = new TextEncoder().encode(request)
      const header = buildHdr(0b0001, 0b0001) // full client, JSON serialization
      ws.send(concat(header, u32be(payload.length), payload))

      // 分片发音频
      const chunkMs = 200 // 每包200ms
      const bytesPerChunk = 16000 * 2 * chunkMs / 1000 // 16k * 2B * 0.2s = 6400
      const totalChunks = Math.ceil(pcmData.length / bytesPerChunk)

      for (let i = 0; i < totalChunks; i++) {
        const start = i * bytesPerChunk
        const end = Math.min(start + bytesPerChunk, pcmData.length)
        const chunk = pcmData.slice(start, end)
        const isLast = i === totalChunks - 1
        const hdr = buildAudioHdr(isLast)
        ws.send(concat(hdr, u32be(chunk.length), chunk))
      }
    }

    let result = ''

    ws.onmessage = (event) => {
      const data = new Uint8Array(event.data as ArrayBuffer)
      if (data.length < 4) return
      const msgType = (data[1] >> 4) & 0x0f

      if (msgType === 0b1001 && data.length >= 12) {
        const payloadSize = new DataView(data.buffer).getUint32(8)
        const payload = data.slice(12, 12 + payloadSize)
        try {
          const json = JSON.parse(new TextDecoder().decode(payload))
          if (json.result?.text) result = json.result.text
        } catch {}
      }

      if (msgType === 0b1111) {
        const err = new TextDecoder().decode(data.slice(12))
        reject(new Error(err || '服务端错误'))
        clearTimeout(timeout)
        ws.close()
      }
    }

    ws.onerror = () => {
      reject(new Error('WebSocket 连接失败'))
      clearTimeout(timeout)
    }

    ws.onclose = () => {
      clearTimeout(timeout)
      if (result) resolve(result)
      else reject(new Error('未收到识别结果'))
    }
  })
}

// === 二进制协议辅助函数 ===

function buildHdr(msgType: number, ser: number): Uint8Array {
  // Byte 0: version=1(4bit), header_size=1(4bit) → 0x11
  // Byte 1: msg_type(4bit) | flags(4bit) — flags=0 for full client
  // Byte 2: serialization(4bit) | compression(4bit) — comp=0 (no gzip for MVP)
  return new Uint8Array([0x11, msgType << 4, ser << 4, 0x00])
}

function buildAudioHdr(isLast: boolean): Uint8Array {
  const flags = isLast ? 0b0010 : 0b0000
  return new Uint8Array([0x11, (0b0010 << 4) | flags, 0x00, 0x00])
}

function u32be(n: number): Uint8Array {
  const b = new ArrayBuffer(4)
  new DataView(b).setUint32(0, n)
  return new Uint8Array(b)
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0)
  const r = new Uint8Array(total)
  let o = 0
  for (const a of arrs) { r.set(a, o); o += a.length }
  return r
}
