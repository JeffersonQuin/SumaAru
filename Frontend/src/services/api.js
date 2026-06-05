import { supabase, supabaseListo } from '../lib/supabase.js'

function resolveApiUrl() {
  const fromEnv = import.meta.env.VITE_API_URL?.trim()
  if (import.meta.env.PROD) {
    if (!fromEnv || /localhost|127\.0\.0\.1/i.test(fromEnv)) {
      return '/api'
    }
    const base = fromEnv.replace(/\/$/, '')
    return base.endsWith('/api') ? base : `${base}/api`
  }
  if (fromEnv) {
    const base = fromEnv.replace(/\/$/, '')
    return base.endsWith('/api') ? base : `${base}/api`
  }
  return 'http://localhost:3000/api'
}

export const API_URL = resolveApiUrl()

async function parseJsonResponse(response) {
  const text = await response.text()
  if (!text) {
    throw new Error(`Respuesta vacía de la API (${response.status})`)
  }
  try {
    return JSON.parse(text)
  } catch {
    const hint = text.includes('server error')
      ? 'La función /api/grabar falló en Vercel (cuerpo muy grande o error interno).'
      : text.slice(0, 120)
    throw new Error(hint)
  }
}

function wrapFetchError(error) {
  if (error?.message === 'Failed to fetch') {
    return new Error('No se pudo conectar con la API.')
  }
  return error
}

async function subirAudioDirecto(audioBlob, datos) {
  const timestamp = Date.now()
  const nombreLimpio = datos.nombre.replace(/\s/g, '_')
  const extension = audioBlob.type?.includes('webm') ? 'webm' : 'wav'
  const nombreArchivo = `${timestamp}_${nombreLimpio}_${datos.tipoGrabacion}.${extension}`

  const { error } = await supabase.storage
    .from('audios')
    .upload(nombreArchivo, audioBlob, {
      contentType: audioBlob.type || 'audio/wav',
      cacheControl: '3600'
    })

  if (error) {
    throw new Error(
      `No se pudo subir el audio a Supabase: ${error.message}. ` +
        'Revisa que el bucket "audios" permita subidas con la clave anon.'
    )
  }

  const { data: urlData } = supabase.storage
    .from('audios')
    .getPublicUrl(nombreArchivo)

  return urlData.publicUrl
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('No se pudo leer el audio'))
        return
      }
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Error al leer el audio'))
    reader.readAsDataURL(blob)
  })
}

export async function guardarGrabacion(audioBlob, datos) {
  const hablante = {
    nombre: datos.nombre,
    edad: datos.edad,
    comunidad: datos.comunidad,
    dialecto: datos.dialecto
  }

  const payload = {
    hablante,
    tipoGrabacion: datos.tipoGrabacion,
    duracion: datos.duracion,
    transcripcion: datos.transcripcion || ''
  }

  if (supabaseListo()) {
    payload.audioUrl = await subirAudioDirecto(audioBlob, datos)
  } else {
    payload.audioBase64 = await blobToBase64(audioBlob)
  }

  try {
    const response = await fetch(`${API_URL}/grabar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const resultado = await parseJsonResponse(response)

    if (!response.ok) {
      const msg = [resultado.error, resultado.details].filter(Boolean).join(': ')
      throw new Error(msg || 'Error al guardar')
    }

    return resultado
  } catch (error) {
    console.error('Error en guardarGrabacion:', error, 'API_URL=', API_URL)
    throw wrapFetchError(error)
  }
}

export async function listarGrabaciones() {
  try {
    const response = await fetch(`${API_URL}/listar`)
    const resultado = await parseJsonResponse(response)

    if (!response.ok) {
      throw new Error(resultado.error || 'Error al listar')
    }

    return resultado.grabaciones || []
  } catch (error) {
    console.error('Error en listarGrabaciones:', error)
    return []
  }
}

export async function corregirTranscripcion(idGrabacion, textoCorregido, textoOriginal) {
  try {
    const response = await fetch(`${API_URL}/corregir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idGrabacion,
        textoCorregido,
        textoOriginal
      })
    })

    const resultado = await parseJsonResponse(response)

    if (!response.ok) {
      throw new Error(resultado.error || 'Error al corregir')
    }

    return resultado
  } catch (error) {
    console.error('Error en corregirTranscripcion:', error)
    throw wrapFetchError(error)
  }
}
