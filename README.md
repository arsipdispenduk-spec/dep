# AI Motion Studio
## Jalankan lokal
`npm i && npm i -g netlify-cli && netlify dev` (butuh `.env` dari `.env.example`).
## Deploy Netlify
1. Push ke GitHub, Netlify > Add new site > Import. Build: `npm run build`, publish: `dist` (sudah di netlify.toml).
2. Site configuration > Environment variables: tambahkan `GEMINI_API_KEY`.
3. Deploy ulang. Key hanya dipakai di `netlify/functions/storyboard.ts`, tidak pernah di frontend.
## Cara kerja ekspor
Canvas direkam di browser (MediaRecorder + audio) lalu diubah ke MP4 dengan FFmpeg.wasm. Durasi rekam = durasi video; biarkan tab tetap terbuka.
## Catatan
- Paket gratis Netlify membatasi fungsi sekitar 10 detik; default memakai model Gemini Flash. Untuk narasi panjang, naikkan timeout (paket berbayar) atau ganti `GEMINI_MODEL`.
- "Render scene ini" merender satu scene tanpa audio narasi. Musik latar dicampur otomatis sesuai slider volume.
- Di HP gunakan 720p/30 FPS agar RAM aman.
