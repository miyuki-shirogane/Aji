const input = document.getElementById('pat') as HTMLInputElement
const save = document.getElementById('save') as HTMLButtonElement
const msg = document.getElementById('msg') as HTMLSpanElement

async function load() {
  const { pat } = await chrome.storage.local.get('pat')
  if (pat) input.value = pat
}

save.addEventListener('click', async () => {
  const pat = input.value.trim()
  if (pat) await chrome.storage.local.set({ pat })
  else await chrome.storage.local.remove('pat')
  msg.textContent = 'Saved'
  setTimeout(() => (msg.textContent = ''), 1500)
})

void load()
