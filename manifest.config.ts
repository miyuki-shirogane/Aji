import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Aji — GitHub 语义代码检索',
  version: '0.1.0',
  description: '在 GitHub 页面用自然语言检索代码（本地向量，代码不出本机）',
  minimum_chrome_version: '116',
  permissions: ['storage', 'unlimitedStorage', 'offscreen'],
  host_permissions: [
    'https://github.com/*',
    'https://api.github.com/*',
    'https://codeload.github.com/*',
    'https://raw.githubusercontent.com/*',
    'https://huggingface.co/*',
    'https://cdn-lfs.huggingface.co/*',
    'https://cdn-lfs-us-1.huggingface.co/*',
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
