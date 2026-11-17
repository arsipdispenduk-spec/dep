import type { Handler } from '@netlify/functions'
const SYS = `Kamu sutradara motion graphic. Pecah narasi menjadi scene. Balas HANYA JSON array tanpa markdown. Tiap item: {"narration":string,"title":string(maks 6 kata),"subtitle":string,"anim":"kinetic"|"kenburns"|"parallax"|"split"|"chart"|"particles","transition":"fade"|"slide"|"mask","duration":number(detik, ~2.5 kata/detik),"imageIdea":string,"chart":number[](3-5 angka 0-100, hanya jika anim=chart)}. Variasikan anim sesuai isi, jangan sama semua.`
export const handler: Handler = async (e) => {
  const key = process.env.GEMINI_API_KEY
  if (!key) return { statusCode: 503, body: JSON.stringify({ error: 'GEMINI_API_KEY belum diatur di Netlify.' }) }
  try {
    const { narration, style, audioDuration } = JSON.parse(e.body || '{}')
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: [{ role: 'user', parts: [{ text: `Gaya: ${style}. ${audioDuration ? `Total durasi audio ${audioDuration} detik.` : ''}\nNarasi:\n${narration}` }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4000, temperature: 0.7 }
      })
    })
    const d = await r.json()
    if (!r.ok) return { statusCode: 502, body: JSON.stringify({ error: d?.error?.message || 'Gagal memanggil Gemini' }) }
    const txt = (d.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').replace(/```json|```/g, '').trim()
    const scenes = JSON.parse(txt)
    if (!Array.isArray(scenes)) throw new Error('Format respons AI tidak valid')
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenes }) }
  } catch (err: any) { return { statusCode: 500, body: JSON.stringify({ error: String(err.message || err) }) } }
}
