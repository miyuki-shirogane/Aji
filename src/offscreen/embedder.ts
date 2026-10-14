import { MODEL_ID } from '../shared/const'

let modPromise: Promise<any> | null = null
let activeDevice = ''

export const getActiveDevice = () => activeDevice

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
      const t0 = Date.now()
      const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator
      const adapter = hasWebGpu
        ? await (navigator as any).gpu.requestAdapter().catch(() => null)
        : null
      const build = async (device: string, dtype: string) => {
        const ex = await pipeline('feature-extraction', MODEL_ID, { dtype, device })
        activeDevice = `${device}/${dtype}`
        console.log(`[aji] model ready device=${activeDevice} in ${Date.now() - t0}ms`)
        return ex
      }
      const attempt = async () => {
        if (adapter) {
          // WebGPU EP does not support int8 well; try the smallest viable dtypes.
          // Skip fp32 to avoid a ~90MB download.
          for (const dtype of ['q8', 'fp16']) {
            try {
              return await build('webgpu', dtype)
            } catch (e) {
              console.warn(`[aji] webgpu/${dtype} 失败`, e)
            }
          }
        }
        return build('wasm', 'q8')
      }
      try {
        return await attempt()
      } catch (e) {
        // huggingface.co is often unreachable in some networks; retry via mirror.
        console.warn('[aji] 模型下载失败，改用镜像 hf-mirror.com 重试', e)
        env.remoteHost = 'https://hf-mirror.com'
        return await attempt()
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
