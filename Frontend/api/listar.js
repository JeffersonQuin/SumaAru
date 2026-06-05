import { supabase, assertSupabaseConfig } from './supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    assertSupabaseConfig()

    const { data, error } = await supabase
      .from('grabaciones')
      .select(`
        id,
        tipo_grabacion,
        duracion_segundos,
        audio_url,
        transcripcion_web_speech,
        transcripcion_corregida,
        fecha,
        hablantes (
          nombre,
          dialecto,
          comunidad
        )
      `)
      .order('fecha', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error al listar:', error)
      return res.status(500).json({ error: 'Error al obtener las grabaciones' })
    }

    return res.status(200).json({ success: true, grabaciones: data })
  } catch (error) {
    console.error('Error general:', error)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}
