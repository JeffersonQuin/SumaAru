import Busboy from 'busboy'
import { supabase } from './supabaseClient.js'

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields = {}
    let audioBuffer = null

    const busboy = Busboy({ headers: req.headers })

    busboy.on('file', (name, file) => {
      const chunks = []
      file.on('data', (chunk) => chunks.push(chunk))
      file.on('end', () => {
        if (name === 'audio') {
          audioBuffer = Buffer.concat(chunks)
        }
      })
    })

    busboy.on('field', (name, value) => {
      fields[name] = value
    })

    busboy.on('finish', () => resolve({ fields, audioBuffer }))
    busboy.on('error', reject)

    req.pipe(busboy)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const { fields, audioBuffer } = await parseMultipart(req)

    if (!audioBuffer?.length) {
      return res.status(400).json({ error: 'No se recibió archivo de audio' })
    }

    const datosHablante = JSON.parse(fields.hablante || '{}')
    const tipoGrabacion = fields.tipoGrabacion || 'historia'
    const duracion = parseInt(fields.duracion || '0', 10)
    const transcripcion = fields.transcripcion || ''

    if (!datosHablante.nombre || !datosHablante.dialecto) {
      return res.status(400).json({ error: 'Faltan datos del hablante' })
    }

    const timestamp = Date.now()
    const nombreLimpio = datosHablante.nombre.replace(/\s/g, '_')
    const nombreArchivo = `${timestamp}_${nombreLimpio}_${tipoGrabacion}.wav`

    const { error: audioError } = await supabase.storage
      .from('audios')
      .upload(nombreArchivo, audioBuffer, {
        contentType: 'audio/wav',
        cacheControl: '3600'
      })

    if (audioError) {
      console.error('Error al subir a Storage:', audioError)
      return res.status(500).json({
        error: 'Error al guardar el audio',
        details: audioError.message
      })
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
          edad: datosHablante.edad ? parseInt(datosHablante.edad, 10) : null,
          comunidad: datosHablante.comunidad || null,
          dialecto: datosHablante.dialecto
        })
        .select()
        .single()

      if (hablanteError) {
        console.error('Error al guardar hablante:', hablanteError)
        return res.status(500).json({
          error: 'Error al guardar el hablante',
          details: hablanteError.message
        })
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
      return res.status(500).json({
        error: 'Error al guardar la grabación',
        details: grabacionError.message
      })
    }

    return res.status(200).json({
      success: true,
      id: grabacion.id,
      audioUrl,
      mensaje: 'Grabación guardada exitosamente'
    })
  } catch (error) {
    console.error('Error general en /api/grabar:', error)
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    })
  }
}
