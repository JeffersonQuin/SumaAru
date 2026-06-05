import { supabase } from './supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    const contentType = req.headers['content-type'] || ''
    const boundary = contentType.split('boundary=')[1]

    if (!boundary) {
      return res.status(400).json({ error: 'No se pudo parsear el FormData' })
    }

    const formData = parseMultipart(buffer, boundary)

    const audioFile = formData.audio
    const datosHablante = JSON.parse(formData.hablante || '{}')
    const tipoGrabacion = formData.tipoGrabacion || 'historia'
    const duracion = parseInt(formData.duracion || '0')
    const transcripcion = formData.transcripcion || ''

    if (!audioFile || !datosHablante.nombre || !datosHablante.dialecto) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' })
    }

    const timestamp = Date.now()
    const nombreLimpio = datosHablante.nombre.replace(/\s/g, '_')
    const nombreArchivo = `${timestamp}_${nombreLimpio}_${tipoGrabacion}.wav`

    const { error: audioError } = await supabase.storage
      .from('audios')
      .upload(nombreArchivo, Buffer.from(audioFile.data), {
        contentType: 'audio/wav',
        cacheControl: '3600'
      })

    if (audioError) {
      console.error('Error al subir a Storage:', audioError)
      return res.status(500).json({ error: 'Error al guardar el audio' })
    }

    const { data: urlData } = supabase.storage
      .from('audios')
      .getPublicUrl(nombreArchivo)

    const audioUrl = urlData.publicUrl

    let idHablante

    const { data: hablanteExistente } = await supabase
      .from('hablantes')
      .select('id')
      .eq('nombre', datosHablante.nombre)
      .eq('dialecto', datosHablante.dialecto)
      .maybeSingle()

    if (hablanteExistente) {
      idHablante = hablanteExistente.id
    } else {
      const { data: nuevoHablante, error: hablanteError } = await supabase
        .from('hablantes')
        .insert({
          nombre: datosHablante.nombre,
          edad: datosHablante.edad ? parseInt(datosHablante.edad) : null,
          comunidad: datosHablante.comunidad || null,
          dialecto: datosHablante.dialecto
        })
        .select()
        .single()

      if (hablanteError) {
        console.error('Error al guardar hablante:', hablanteError)
        return res.status(500).json({ error: 'Error al guardar los datos del hablante' })
      }

      idHablante = nuevoHablante.id
    }

    const { data: grabacion, error: grabacionError } = await supabase
      .from('grabaciones')
      .insert({
        id_hablante: idHablante,
        tipo_grabacion: tipoGrabacion,
        duracion_segundos: duracion,
        audio_url: audioUrl,
        transcripcion_web_speech: transcripcion || null
      })
      .select()
      .single()

    if (grabacionError) {
      console.error('Error al guardar grabación:', grabacionError)
      return res.status(500).json({ error: 'Error al guardar la grabación' })
    }

    return res.status(200).json({
      success: true,
      id: grabacion.id,
      audioUrl: audioUrl,
      mensaje: 'Grabación guardada exitosamente'
    })

  } catch (error) {
    console.error('Error general:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

function parseMultipart(buffer, boundary) {
  const result = {}
  const boundaryBuffer = Buffer.from(`--${boundary}`)

  let position = 0
  let ended = false

  while (!ended && position < buffer.length) {
    const boundaryIndex = buffer.indexOf(boundaryBuffer, position)
    if (boundaryIndex === -1) break

    position = boundaryIndex + boundaryBuffer.length

    const headersEndIndex = buffer.indexOf('\r\n\r\n', position)
    if (headersEndIndex === -1) break

    const headers = buffer.subarray(position, headersEndIndex).toString()
    position = headersEndIndex + 4

    const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, position)
    if (nextBoundaryIndex === -1) {
      ended = true
      break
    }

    const content = buffer.subarray(position, nextBoundaryIndex - 2)
    position = nextBoundaryIndex

    const nameMatch = headers.match(/name="([^"]+)"/)
    const filenameMatch = headers.match(/filename="([^"]+)"/)

    if (nameMatch) {
      const name = nameMatch[1]
      if (filenameMatch) {
        result[name] = {
          filename: filenameMatch[1],
          data: content,
          contentType: headers.match(/Content-Type: ([^\r\n]+)/)?.[1] || 'application/octet-stream'
        }
      } else {
        result[name] = content.toString()
      }
    }
  }

  return result
}
