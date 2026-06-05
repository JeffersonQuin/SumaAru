export async function saveGrabacion(supabase, {
  audioBuffer,
  audioUrl,
  hablante,
  tipoGrabacion = 'historia',
  duracion = 0,
  transcripcion = ''
}) {
  if (!hablante?.nombre || !hablante?.dialecto) {
    throw new Error('Faltan datos del hablante')
  }

  let finalAudioUrl = audioUrl

  if (!finalAudioUrl) {
    if (!audioBuffer?.length) {
      throw new Error('No se recibió archivo de audio')
    }

    const timestamp = Date.now()
    const nombreLimpio = hablante.nombre.replace(/\s/g, '_')
    const nombreArchivo = `${timestamp}_${nombreLimpio}_${tipoGrabacion}.wav`

    const { error: audioError } = await supabase.storage
      .from('audios')
      .upload(nombreArchivo, audioBuffer, {
        contentType: 'audio/wav',
        cacheControl: '3600'
      })

    if (audioError) {
      throw new Error(`Storage: ${audioError.message}`)
    }

    const { data: urlData } = supabase.storage
      .from('audios')
      .getPublicUrl(nombreArchivo)

    finalAudioUrl = urlData.publicUrl
  }

  let idHablante

  const { data: hablanteExistente } = await supabase
    .from('hablantes')
    .select('id')
    .eq('nombre', hablante.nombre)
    .eq('dialecto', hablante.dialecto)
    .maybeSingle()

  if (hablanteExistente) {
    idHablante = hablanteExistente.id
  } else {
    const { data: nuevoHablante, error: hablanteError } = await supabase
      .from('hablantes')
      .insert({
        nombre: hablante.nombre,
        edad: hablante.edad ? parseInt(hablante.edad, 10) : null,
        comunidad: hablante.comunidad || null,
        dialecto: hablante.dialecto
      })
      .select()
      .single()

    if (hablanteError) {
      throw new Error(`Hablante: ${hablanteError.message}`)
    }
    idHablante = nuevoHablante.id
  }

  const { data: grabacion, error: grabacionError } = await supabase
    .from('grabaciones')
    .insert({
      id_hablante: idHablante,
      tipo_grabacion: tipoGrabacion,
      duracion_segundos: parseInt(String(duracion), 10) || 0,
      audio_url: finalAudioUrl,
      transcripcion_web_speech: transcripcion || null
    })
    .select()
    .single()

  if (grabacionError) {
    throw new Error(`Grabación: ${grabacionError.message}`)
  }

  return {
    id: grabacion.id,
    audioUrl: finalAudioUrl
  }
}
