import { supabase, assertSupabaseConfig } from './supabaseClient.js'
import { saveGrabacion } from './saveGrabacion.js'

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('JSON inválido en el cuerpo de la petición'))
      }
    })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    assertSupabaseConfig()

    const body = await readJsonBody(req)

    if (!body.audioBase64) {
      return res.status(400).json({ error: 'Falta audioBase64 en el cuerpo' })
    }

    const audioBuffer = Buffer.from(body.audioBase64, 'base64')
    const hablante =
      typeof body.hablante === 'string'
        ? JSON.parse(body.hablante)
        : body.hablante

    const result = await saveGrabacion(supabase, {
      audioBuffer,
      hablante,
      tipoGrabacion: body.tipoGrabacion || 'historia',
      duracion: body.duracion ?? 0,
      transcripcion: body.transcripcion || ''
    })

    return res.status(200).json({
      success: true,
      id: result.id,
      audioUrl: result.audioUrl,
      mensaje: 'Grabación guardada exitosamente'
    })
  } catch (error) {
    console.error('Error en /api/grabar:', error)
    const msg = error.message || 'Error desconocido'
    const isConfig = msg.includes('Supabase') || msg.includes('entorno')
    return res.status(isConfig ? 503 : 500).json({
      error: isConfig ? 'API sin configurar en Vercel' : 'Error al guardar',
      details: msg
    })
  }
}
