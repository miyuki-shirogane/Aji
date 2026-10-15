import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Aji — GitHub 语义代码检索',
  version: '0.2.0',
  description: '在 GitHub 页面用自然语言检索代码（本地向量，代码不出本机）',
  minimum_chrome_version: '116',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
    },
  },
  permissions: ['storage', 'unlimitedStorage', 'offscreen'],
  host_permissions: [
    'https://github.com/*',
    'https://api.github.com/*',
    'https://codeload.github.com/*',
    'https://raw.githubusercontent.com/*',
    'https://huggingface.co/*',
    'https://cdn-lfs.huggingface.co/*',
    'https://cdn-lfs-us-1.huggingface.co/*',
    'https://hf-mirror.com/*',
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://github.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
    },
  ],
  options_page: 'src/options/index.html',
  web_accessible_resources: [
    {
      resources: ['wasm/*', 'src/offscreen/offscreen.html'],
      matches: ['https://github.com/*'],
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
})
