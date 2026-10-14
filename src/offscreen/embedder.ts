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
      const { pipeline } = await getModule()
      const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator
      if (hasWebGpu) {
        try {
          return await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8', device: 'webgpu' })
        } catch (e) {
          console.warn('[aji] webgpu 初始化失败，回退 wasm', e)
        }
      }
      return pipeline('feature-extraction', MODEL_ID, { dtype: 'q8', device: 'wasm' })
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
