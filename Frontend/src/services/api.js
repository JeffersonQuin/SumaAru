// En Vercel: mismo dominio (/api). En local: Express en :3000
const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api')

// Guardar una grabación
export async function guardarGrabacion(audioBlob, datos) {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'grabacion.wav')
  formData.append('hablante', JSON.stringify({
    nombre: datos.nombre,
    edad: datos.edad,
    comunidad: datos.comunidad,
    dialecto: datos.dialecto
  }))
  formData.append('tipoGrabacion', datos.tipoGrabacion)
  formData.append('duracion', datos.duracion.toString())
  formData.append('transcripcion', datos.transcripcion)

  try {
    const response = await fetch(`${API_URL}/grabar`, {
      method: 'POST',
      body: formData
    })
    
    const resultado = await response.json()
    
    if (!response.ok) {
      throw new Error(resultado.error || 'Error al guardar')
    }
    
    return resultado
  } catch (error) {
    console.error('Error en guardarGrabacion:', error)
    throw error
  }
}

// Listar todas las grabaciones
export async function listarGrabaciones() {
  try {
    const response = await fetch(`${API_URL}/listar`)
    const resultado = await response.json()
    
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
    
    const resultado = await response.json()
    
    if (!response.ok) {
      throw new Error(resultado.error || 'Error al corregir')
    }
    
    return resultado
  } catch (error) {
    console.error('Error en corregirTranscripcion:', error)
    throw error
  }
}