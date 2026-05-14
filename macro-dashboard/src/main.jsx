import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ─────────────────────────────────────────────────────────────
// window.storage 폴리필
// App.jsx 는 window.storage.get/set/delete/list 를 사용한다.
// (원래 Claude Artifacts 환경의 API — Vite 에서는 없으므로
//  localStorage 기반으로 직접 구현해 둔다.)
// ─────────────────────────────────────────────────────────────
if (!window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key)
      if (v === null) throw new Error('not found: ' + key)
      return { key, value: v }
    },
    async set(key, value) {
      localStorage.setItem(key, String(value))
      return { key, value }
    },
    async delete(key) {
      const had = localStorage.getItem(key) !== null
      localStorage.removeItem(key)
      return { key, deleted: had }
    },
    async list(prefix) {
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!prefix || k.startsWith(prefix)) keys.push(k)
      }
      return { keys, prefix }
    },
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
