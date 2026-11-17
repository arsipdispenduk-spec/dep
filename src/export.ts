import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { Scene, render, total } from './engine'
export type Opts = { audio: File | null; trim: [number, number]; music: File | null; musicVol: number; fps: number }
export async function exportVideo(canvas: HTMLCanvasElement, scenes: Scene[], o: Opts, onProgress: (p: number, msg: string) => void): Promise<Blob> {
  const ctx = canvas.getContext('2d')!, dur = total(scenes), stream = canvas.captureStream(o.fps)
  let ac: AudioContext | null = null; const starts: (() => void)[] = []
  if (o.audio || o.music) {
    ac = new AudioContext(); const d = ac.createMediaStreamDestination()
    if (o.audio) { const s = ac.createBufferSource(); s.buffer = await ac.decodeAudioData(await o.audio.arrayBuffer()); s.connect(d); starts.push(() => s.start(0, o.trim[0], Math.max(.1, o.trim[1] - o.trim[0]))) }
    if (o.music) { const s = ac.createBufferSource(); s.buffer = await ac.decodeAudioData(await o.music.arrayBuffer()); s.loop = true; const g = ac.createGain(); g.gain.value = o.musicVol; s.connect(g); g.connect(d); starts.push(() => s.start()) }
    d.stream.getAudioTracks().forEach(t => stream.addTrack(t))
  }
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)); if (!mime) throw new Error('Browser tidak mendukung perekaman video.')
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 }), chunks: Blob[] = []
  rec.ondataavailable = e => e.data.size && chunks.push(e.data)
  const done = new Promise<void>(r => (rec.onstop = () => r()))
  rec.start(500); starts.forEach(s => s()); const t0 = performance.now()
  await new Promise<void>(res => { const tick = () => { const t = (performance.now() - t0) / 1000; render(ctx, canvas.width, canvas.height, scenes, Math.min(t, dur - .001)); onProgress(Math.min(.7, t / dur * .7), 'Merekam adegan…'); t >= dur ? res() : requestAnimationFrame(tick) }; tick() })
  rec.stop(); await done; ac?.close()
  const webm = new Blob(chunks, { type: 'video/webm' })
  onProgress(.72, 'Memuat FFmpeg…')
  const ff = new FFmpeg(); const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm'
  ff.on('progress', ({ progress }) => onProgress(.75 + Math.min(1, progress) * .25, 'Mengonversi ke MP4…'))
  await ff.load({ coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm') })
  await ff.writeFile('in.webm', await fetchFile(webm))
  await ff.exec(['-i', 'in.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-r', String(o.fps), '-c:a', 'aac', '-movflags', '+faststart', 'out.mp4'])
  const out = (await ff.readFile('out.mp4')) as Uint8Array; ff.terminate()
  return new Blob([out], { type: 'video/mp4' })
}
