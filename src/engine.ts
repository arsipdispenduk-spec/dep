export type Anim = 'kinetic' | 'kenburns' | 'parallax' | 'split' | 'chart' | 'particles'
export type Scene = { id: string; narration: string; title: string; subtitle: string; anim: Anim; transition: 'fade' | 'slide' | 'mask'; duration: number; image?: string; chart?: number[]; imageIdea?: string }
export const ASPECT = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1080, 1080] } as const
const ease = (x: number) => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
const imgCache = new Map<string, HTMLImageElement>()
export function loadImg(src: string) { let i = imgCache.get(src); if (!i) { i = new Image(); i.src = src; imgCache.set(src, i) } return i }
export const total = (s: Scene[]) => s.reduce((a, b) => a + b.duration, 0)
export function locate(s: Scene[], t: number) { let a = 0; for (let i = 0; i < s.length; i++) { if (t < a + s[i].duration || i === s.length - 1) return { i, p: Math.min(1, Math.max(0, (t - a) / s[i].duration)), a }; a += s[i].duration } return { i: 0, p: 0, a: 0 } }
function wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, mw: number, lh: number, reveal = 1) {
  const words = text.split(' '); let line = '', ly = y; const lines: string[] = []
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > mw && line) { lines.push(line); line = w } else line = t }
  lines.push(line); const n = Math.ceil(words.length * reveal); let shown = 0
  lines.forEach(l => { const ws = l.split(' '); const take = Math.max(0, Math.min(ws.length, n - shown)); shown += ws.length; c.fillText(ws.slice(0, take).join(' '), x, ly); ly += lh })
}
function drawScene(c: CanvasRenderingContext2D, W: number, H: number, s: Scene, p: number) {
  const hue = (s.title.length * 37) % 360, e = ease(Math.min(1, p * 3))
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, `hsl(${hue},45%,12%)`); g.addColorStop(1, `hsl(${(hue + 50) % 360},50%,20%)`); c.fillStyle = g; c.fillRect(0, 0, W, H)
  const img = s.image ? loadImg(s.image) : null
  if (img && img.complete && img.naturalWidth) {
    const z = s.anim === 'kenburns' ? 1.05 + .15 * p : s.anim === 'parallax' ? 1.2 : 1.08, ox = s.anim === 'parallax' ? (p - .5) * W * .12 : 0
    const r = Math.max(W / img.naturalWidth, H / img.naturalHeight) * z, w = img.naturalWidth * r, h = img.naturalHeight * r
    c.save(); if (s.anim === 'split') { c.beginPath(); c.rect(W / 2, 0, W / 2, H); c.clip() }
    c.drawImage(img, (W - w) / 2 + ox, (H - h) / 2, w, h); c.restore()
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H)
  }
  if (s.anim === 'particles') { for (let i = 0; i < 60; i++) { const sx = (i * 9301 + 49297) % 233280 / 233280; const x = sx * W, y = (H - ((p * H * (.3 + sx) + i * 40) % H)); c.fillStyle = `hsla(${hue + 40},80%,70%,${.15 + sx * .4})`; c.beginPath(); c.arc(x, y, 2 + sx * 5, 0, 7); c.fill() } }
  if (s.anim === 'chart' && s.chart?.length) {
    const n = s.chart.length, bw = W * .6 / n, base = H * .78
    s.chart.forEach((v, i) => { const h = (v / 100) * H * .4 * ease(Math.min(1, Math.max(0, p * 2.5 - i * .15))); c.fillStyle = `hsl(${hue + i * 25},70%,60%)`; c.fillRect(W * .2 + i * bw + 8, base - h, bw - 16, h) })
  }
  const pad = W * .08, fs = Math.round(W * (W > H ? .05 : .075))
  c.fillStyle = '#fff'; c.textBaseline = 'top'; c.font = `800 ${fs}px system-ui,sans-serif`
  c.save(); c.globalAlpha = e
  c.translate(s.anim === 'split' ? 0 : (1 - e) * -60, s.anim === 'kinetic' ? (1 - e) * 40 : 0)
  wrap(c, s.title, pad, H * .3, W - pad * 2, fs * 1.15, s.anim === 'kinetic' ? Math.min(1, p * 4) : 1); c.restore()
  c.font = `500 ${Math.round(fs * .42)}px system-ui,sans-serif`; c.fillStyle = 'rgba(255,255,255,.95)'
  c.fillRect(pad, H * .86 - fs * .5, W - pad * 2, fs * .9); c.fillStyle = '#111'
  wrap(c, s.subtitle, pad + 14, H * .86 - fs * .42, W - pad * 2 - 28, fs * .5)
}
export function render(c: CanvasRenderingContext2D, W: number, H: number, sc: Scene[], t: number) {
  if (!sc.length) { c.fillStyle = '#101318'; c.fillRect(0, 0, W, H); return }
  const { i, p } = locate(sc, t); const s = sc[i]; drawScene(c, W, H, s, p)
  const TR = .08; if (i > 0 && p < TR) { const q = ease(p / TR); c.save()
    if (s.transition === 'fade') { drawScene(c, W, H, sc[i - 1], 1); c.globalAlpha = q; drawScene(c, W, H, s, p) }
    else if (s.transition === 'slide') { c.translate(-W * q, 0); drawScene(c, W, H, sc[i - 1], 1); c.translate(W, 0); drawScene(c, W, H, s, p) }
    else { drawScene(c, W, H, sc[i - 1], 1); c.beginPath(); c.arc(W / 2, H / 2, Math.hypot(W, H) * q / 2, 0, 7); c.clip(); drawScene(c, W, H, s, p) }
    c.restore() }
}
