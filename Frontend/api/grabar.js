import { supabase, assertSupabaseConfig } from './supabaseClient.js'
import { saveGrabacion } from './saveGrabacion.js'

async function getBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body
  }
  if (typeof req.body === 'string' && req.body.length > 0) {
    return JSON.parse(req.body)
  }

  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('JSON inválido'))
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

    const body = await getBody(req)
    const hablante =
      typeof body.hablante === 'string'
        ? JSON.parse(body.hablante)
        : body.hablante

    let result

    if (body.audioUrl) {
      result = await saveGrabacion(supabase, {
        audioUrl: body.audioUrl,
        hablante,
        tipoGrabacion: body.tipoGrabacion || 'historia',
        duracion: body.duracion ?? 0,
        transcripcion: body.transcripcion || ''
      })
    } else if (body.audioBase64) {
      const audioBuffer = Buffer.from(body.audioBase64, 'base64')
      result = await saveGrabacion(supabase, {
        audioBuffer,
        hablante,
        tipoGrabacion: body.tipoGrabacion || 'historia',
        duracion: body.duracion ?? 0,
        transcripcion: body.transcripcion || ''
      })
    } else {
      return res.status(400).json({ error: 'Falta audioUrl o audioBase64' })
    }

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
