import { useEffect, useMemo, useRef, useState } from 'react'
import { ASPECT, Scene, render, total, locate } from './engine'
const STYLES = ['Modern Motion Graphic', 'Documentary', 'Psychology Explainer', 'Educational Animation', 'Cinematic Storytelling', 'Minimalist Infographic', 'News Explainer', '2D Animated Illustration']
const uid = () => Math.random().toString(36).slice(2, 9)
async function callAI(narration: string, style: string, audioDuration?: number) {
  const r = await fetch('/.netlify/functions/storyboard', { method: 'POST', body: JSON.stringify({ narration, style, audioDuration }) })
  const d = await r.json().catch(() => ({ error: 'Respons server tidak valid (fungsi belum aktif?)' })); if (!r.ok) throw new Error(d.error || 'Gagal memanggil AI'); return d.scenes as any[]
}
async function readPdf(f: File) {
  const pdfjs = await import('pdfjs-dist')
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise; let out = ''
  for (let i = 1; i <= doc.numPages; i++) out += (await (await doc.getPage(i)).getTextContent()).items.map((x: any) => x.str).join(' ') + '\n'
  return out
}
export default function App() {
  const [text, setText] = useState(''), [audio, setAudio] = useState<File | null>(null), [aLen, setALen] = useState(0), [trim, setTrim] = useState<[number, number]>([0, 0])
  const [music, setMusic] = useState<File | null>(null), [mVol, setMVol] = useState(.15)
  const [images, setImages] = useState<string[]>([]), [ratio, setRatio] = useState<keyof typeof ASPECT>('16:9'), [res, setRes] = useState(720), [fps, setFps] = useState(30), [style, setStyle] = useState(STYLES[0])
  const [scenes, setScenes] = useState<Scene[]>([]), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [prog, setProg] = useState(0), [t, setT] = useState(0), [playing, setPlaying] = useState(false), [url, setUrl] = useState('')
  const cv = useRef<HTMLCanvasElement>(null), au = useRef<HTMLAudioElement>(null), raf = useRef(0), drag = useRef(-1)
  const k = res / 720, W = ASPECT[ratio][0] * k, H = ASPECT[ratio][1] * k, aDur = Math.max(0, +(trim[1] - trim[0]).toFixed(1))
  const audioUrl = useMemo(() => audio ? URL.createObjectURL(audio) : '', [audio])
  useEffect(() => { const c = cv.current?.getContext('2d'); if (c) render(c, W, H, scenes, t) }, [t, scenes, W, H, images])
  useEffect(() => { if (!playing) return; const t0 = performance.now() - t * 1000, tick = () => { const n = (performance.now() - t0) / 1000; if (n >= total(scenes)) { setPlaying(false); setT(0); au.current?.pause(); return } setT(n); raf.current = requestAnimationFrame(tick) }; raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current) }, [playing])
  const play = () => { if (!scenes.length) return; if (playing) { au.current?.pause(); setPlaying(false) } else { if (au.current) { au.current.currentTime = trim[0] + t; au.current.play() } setPlaying(true) } }
  async function onDoc(f?: File) {
    if (!f) return; setErr(''); setBusy('Membaca dokumen...')
    try { const n = f.name.toLowerCase()
      if (n.endsWith('.txt')) setText(await f.text())
      else if (n.endsWith('.docx')) { // @ts-ignore
        const m = (await import('mammoth/mammoth.browser')).default; setText((await m.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value) }
      else if (n.endsWith('.pdf')) setText(await readPdf(f)); else setErr('Gunakan TXT, DOCX, atau PDF.')
    } catch (e: any) { setErr('Gagal membaca file: ' + e.message) } finally { setBusy('') }
  }
  function onAudio(f?: File) { if (!f) return; setAudio(f); const a = new Audio(URL.createObjectURL(f)); a.onloadedmetadata = () => { const d = +a.duration.toFixed(1); setALen(d); setTrim([0, d]) } }
  const fit = (l: Scene[], d = aDur) => { if (!d) return l; const s = total(l) || 1; return l.map(x => ({ ...x, duration: +(x.duration * d / s).toFixed(2) })) }
  async function gen() {
    if (!text.trim()) return setErr('Masukkan narasi terlebih dahulu.'); setErr(''); setBusy('Menyusun storyboard...')
    try { const l = await callAI(text, style, aDur || undefined); setScenes(fit(l.map((s, i) => ({ ...s, id: uid(), image: images[i % Math.max(1, images.length)] })))); setT(0) }
    catch (e: any) { setErr(e.message + ' - pastikan GEMINI_API_KEY sudah diatur di Netlify (lihat README).') } finally { setBusy('') }
  }
  async function regen(s: Scene) { setBusy('Membuat ulang scene...'); try { const [n] = await callAI(s.narration, style); setScenes(a => a.map(x => x.id === s.id ? { ...x, ...n, id: s.id, image: x.image, duration: x.duration, narration: s.narration } : x)) } catch (e: any) { setErr(e.message) } finally { setBusy('') } }
  const upd = (id: string, p: Partial<Scene>) => setScenes(s => s.map(x => x.id === id ? { ...x, ...p } : x))
  async function renderVideo(only?: Scene) {
    setErr(''); setUrl(''); setPlaying(false); setBusy('Rendering...'); setProg(0)
    try { const { exportVideo } = await import('./export'); const b = await exportVideo(cv.current!, only ? [only] : scenes, { audio: only ? null : audio, trim, music, musicVol: mVol, fps }, (p, m) => { setProg(p); setBusy(m) }); setUrl(URL.createObjectURL(b)) }
    catch (e: any) { setErr('Render gagal: ' + e.message) } finally { setBusy('') }
  }
  const sum = total(scenes), cur = scenes.length ? locate(scenes, t).i : -1
  return (<div className="wrap">
    <div className="card"><h1>AI Motion Studio</h1>
      <h2>1. Narasi</h2><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Tempel narasi di sini..." /><input type="file" accept=".txt,.docx,.pdf" onChange={e => onDoc(e.target.files?.[0])} />
      <h2>2. Audio narasi {aLen ? `(${aLen} dtk)` : ''}</h2><input type="file" accept="audio/mpeg,audio/wav,audio/mp4,.m4a,.mp3,.wav" onChange={e => onAudio(e.target.files?.[0])} />
      {audio && <><div className="row"><input type="number" min={0} max={trim[1]} step={.1} value={trim[0]} onChange={e => setTrim([+e.target.value, trim[1]])} /><input type="number" min={trim[0]} max={aLen} step={.1} value={trim[1]} onChange={e => setTrim([trim[0], Math.min(aLen, +e.target.value)])} /></div><div className="msg">Potong audio (mulai dan akhir, detik). Durasi terpakai {aDur} dtk.</div><button className="g" onClick={() => setScenes(s => fit(s))}>Sesuaikan scene ke audio</button></>}
      <h2>3. Gambar ({images.length}), seret untuk mengurutkan</h2><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => e.target.files && setImages(p => [...p, ...Array.from(e.target.files!).map(f => URL.createObjectURL(f))])} />
      <div className="row">{images.map((u, i) => <img key={u} src={u} draggable onDragStart={() => (drag.current = i)} onDragOver={e => e.preventDefault()} onDrop={() => setImages(p => { const a = [...p], [m] = a.splice(drag.current, 1); a.splice(i, 0, m); return a })} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flex: 'none' }} />)}</div>
      <h2>4. Musik latar</h2><input type="file" accept="audio/*" onChange={e => setMusic(e.target.files?.[0] || null)} /><input type="range" min={0} max={.6} step={.01} value={mVol} onChange={e => setMVol(+e.target.value)} />
      <h2>5. Format dan gaya</h2><div className="row"><select value={ratio} onChange={e => setRatio(e.target.value as any)}>{Object.keys(ASPECT).map(r => <option key={r}>{r}</option>)}</select><select value={res} onChange={e => setRes(+e.target.value)}><option value={720}>720p</option><option value={1080}>1080p</option></select><select value={fps} onChange={e => setFps(+e.target.value)}>{[24, 30, 60].map(f => <option key={f} value={f}>{f} FPS</option>)}</select></div>
      <select value={style} onChange={e => setStyle(e.target.value)}>{STYLES.map(s => <option key={s}>{s}</option>)}</select>
      <button disabled={!!busy} onClick={gen}>Buat storyboard</button>
      {err && <div className="msg err">{err}</div>}</div>
    <div className="card"><canvas ref={cv} width={W} height={H} />
      {audioUrl && <audio ref={au} src={audioUrl} />}
      <div className="row"><button className="g" onClick={play} disabled={!scenes.length}>{playing ? 'Jeda' : 'Putar pratinjau'}</button><button disabled={!scenes.length || !!busy} onClick={() => renderVideo()}>Render video</button></div>
      <input type="range" min={0} max={sum || 1} step={.05} value={t} onChange={e => setT(+e.target.value)} />
      <div style={{ display: 'flex', height: 26, gap: 2 }}>{scenes.map((s, i) => <div key={s.id} title={s.title} onClick={() => setT(scenes.slice(0, i).reduce((a, b) => a + b.duration, 0))} style={{ flex: s.duration, background: i === cur ? 'var(--ac)' : 'var(--ln)', borderRadius: 4, cursor: 'pointer', overflow: 'hidden', fontSize: 11, color: i === cur ? '#06201c' : 'var(--mu)', padding: '3px 4px' }}>{i + 1}</div>)}</div>
      {busy && <><div className="msg">{busy}</div><div className="bar"><i style={{ width: prog * 100 + '%' }} /></div></>}
      {url && <a href={url} download="ai-motion-studio.mp4"><button style={{ width: '100%' }}>Unduh MP4</button></a>}
      {scenes.map((s, i) => <div className="sc" key={s.id} style={i === cur ? { borderColor: 'var(--ac)' } : {}}>
        <b>Scene {i + 1}</b><div className="msg">{s.narration}</div>
        <input value={s.title} onChange={e => upd(s.id, { title: e.target.value })} /><input value={s.subtitle} onChange={e => upd(s.id, { subtitle: e.target.value })} />
        <div className="row"><select value={s.anim} onChange={e => upd(s.id, { anim: e.target.value as any })}>{['kinetic', 'kenburns', 'parallax', 'split', 'chart', 'particles'].map(a => <option key={a}>{a}</option>)}</select>
          <select value={s.transition} onChange={e => upd(s.id, { transition: e.target.value as any })}>{['fade', 'slide', 'mask'].map(a => <option key={a}>{a}</option>)}</select>
          <input type="number" min={1} step={.5} value={s.duration} onChange={e => upd(s.id, { duration: Math.max(1, +e.target.value) })} /></div>
        {images.length > 0 && <select value={s.image || ''} onChange={e => upd(s.id, { image: e.target.value || undefined })}><option value="">Tanpa gambar</option>{images.map((u, n) => <option key={u} value={u}>Gambar {n + 1}</option>)}</select>}
        {s.imageIdea && <div className="msg">Ide visual: {s.imageIdea}</div>}
        <div className="row"><button className="g" disabled={!!busy} onClick={() => regen(s)}>Generate ulang</button><button className="g" disabled={!!busy} onClick={() => renderVideo(s)}>Render scene ini</button></div></div>)}
    </div></div>)
}
