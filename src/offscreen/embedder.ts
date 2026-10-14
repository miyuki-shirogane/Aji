import { MODEL_ID } from '../shared/const'

let modPromise: Promise<any> | null = null

async function getModule(): Promise<any> {
  if (!modPromise) {
    modPromise = import('@huggingface/transformers').then(m => {
      const { env } = m
      env.allowLocalModels = false
      env.allowRemoteModels = true
      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = 1
        env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/ort/')
      }
      return m
    })
  }
  return modPromise
}

let extractorPromise: Promise<any> | null = null

async function getExtractor(): Promise<any> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await getModule()
      const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator
      const build = (device: string) => pipeline('feature-extraction', MODEL_ID, { dtype: 'q8', device })
      const preferWebGpu = async () => {
        if (hasWebGpu) {
          try {
            return await build('webgpu')
          } catch (e) {
            console.warn('[aji] webgpu 初始化失败，回退 wasm', e)
          }
        }
        return build('wasm')
      }
      try {
        return await preferWebGpu()
      } catch (e) {
        // huggingface.co is often unreachable in some networks; retry via mirror.
        console.warn('[aji] 模型下载失败，改用镜像 hf-mirror.com 重试', e)
        env.remoteHost = 'https://hf-mirror.com'
        return await preferWebGpu()
      }
    })()
  }
  return extractorPromise
}

export async function embed(texts: string[]): Promise<Float32Array[]> {
  const extractor = await getExtractor()
  const out = await extractor(texts, { pooling: 'mean', normalize: true })
  const list = out.tolist() as number[][]
  return list.map(v => Float32Array.from(v))
}
