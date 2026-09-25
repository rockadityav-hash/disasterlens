// Keep the original local API default; allow an independent deployment origin
// or the same-origin /backend proxy used by the Docker frontend.
export const apiBase = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000').replace(/\/+$/, '')
