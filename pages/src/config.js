// API configuration
// In production, calls go directly to the worker
// In development, Vite proxies to localhost:8787
const isDev = import.meta.env.DEV

export const API_BASE = isDev ? '' : 'https://api.joeyhiller.com'
