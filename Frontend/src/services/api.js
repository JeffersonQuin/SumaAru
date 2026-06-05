// En producción siempre usar /api del mismo dominio (nunca localhost)
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

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('No se pudo leer el audio'))
        return
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo de audio'))
    reader.readAsDataURL(blob)
  })
}

async function parseJsonResponse(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      text.startsWith('<')
        ? `La API devolvió HTML (${response.status}). Revisa /api/grabar en Vercel.`
        : text.slice(0, 150) || `Error HTTP ${response.status}`
    )
  }
}

function wrapFetchError(error) {
  if (error?.message === 'Failed to fetch') {
    return new Error(
      'No se pudo conectar con la API. ¿Hiciste redeploy después de los cambios?'
    )
  }
  return error
}

// Guardar una grabación (JSON + base64: funciona en Vercel y en local)
export async function guardarGrabacion(audioBlob, datos) {
  const audioBase64 = await blobToBase64(audioBlob)

  const payload = {
    audioBase64,
    hablante: {
      nombre: datos.nombre,
      edad: datos.edad,
      comunidad: datos.comunidad,
      dialecto: datos.dialecto
    },
    tipoGrabacion: datos.tipoGrabacion,
    duracion: datos.duracion,
    transcripcion: datos.transcripcion || ''
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

// Listar todas las grabaciones
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

// Enviar corrección de transcripción
export async function corregirTranscripcion(idGrabacion, textoCorregido, textoOriginal) {
  try {
    const response = await fetch(`${API_URL}/corregir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
