import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const port = 3000

// Middleware
app.use(cors())
app.use(express.json())

// Configurar multer para procesar archivos
const upload = multer({ storage: multer.memoryStorage() })

// Inicializar Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Faltan variables de entorno')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Endpoint para guardar grabación
app.post('/api/grabar', upload.single('audio'), async (req, res) => {
  console.log('📥 Recibida petición POST /api/grabar')
  
  try {
    // Verificar archivo
    if (!req.file) {
      console.log('❌ No se recibió archivo')
      return res.status(400).json({ error: 'No se recibió archivo de audio' })
    }
    
    // Verificar datos del hablante
    if (!req.body.hablante) {
      console.log('❌ No se recibieron datos del hablante')
      return res.status(400).json({ error: 'Faltan datos del hablante' })
    }
    
    const hablante = JSON.parse(req.body.hablante)
    console.log(`👤 Hablante: ${hablante.nombre}`)
    
    // Generar nombre único
    const timestamp = Date.now()
    const nombreArchivo = `${timestamp}_${hablante.nombre.replace(/\s/g, '_')}.wav`
    
    // Subir a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audios')
      .upload(nombreArchivo, req.file.buffer, {
        contentType: 'audio/wav',
        cacheControl: '3600'
      })
    
    if (uploadError) {
      console.error('❌ Error al subir:', uploadError)
      return res.status(500).json({ error: 'Error al guardar el audio', details: uploadError.message })
    }
    
    console.log('✅ Archivo subido')
    
    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('audios')
      .getPublicUrl(nombreArchivo)
    
    // Buscar si el hablante ya existe
    let idHablante
    
    const { data: hablanteExistente, error: searchError } = await supabase
      .from('hablantes')
      .select('id')
      .eq('nombre', hablante.nombre)
      .eq('dialecto', hablante.dialecto)
      .maybeSingle()
    
    if (hablanteExistente) {
      idHablante = hablanteExistente.id
      console.log(`👤 Hablante existente ID: ${idHablante}`)
    } else {
      // Crear nuevo hablante
      const { data: nuevoHablante, error: insertError } = await supabase
        .from('hablantes')
        .insert({
          nombre: hablante.nombre,
          edad: hablante.edad ? parseInt(hablante.edad) : null,
          comunidad: hablante.comunidad || null,
          dialecto: hablante.dialecto
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('❌ Error al crear hablante:', insertError)
        return res.status(500).json({ error: 'Error al guardar el hablante' })
      }
      
      idHablante = nuevoHablante.id
      console.log(`👤 Nuevo hablante creado ID: ${idHablante}`)
    }
    
    // Guardar grabación
    const { data: grabacion, error: grabacionError } = await supabase
      .from('grabaciones')
      .insert({
        id_hablante: idHablante,
        tipo_grabacion: req.body.tipoGrabacion || 'historia',
        duracion_segundos: parseInt(req.body.duracion || '0'),
        audio_url: urlData.publicUrl,
        transcripcion_web_speech: req.body.transcripcion || null
      })
      .select()
      .single()
    
    if (grabacionError) {
      console.error('❌ Error al guardar grabación:', grabacionError)
      return res.status(500).json({ error: 'Error al guardar la grabación' })
    }
    
    console.log(`✅ Grabación guardada ID: ${grabacion.id}`)
    
    res.json({
      success: true,
      id: grabacion.id,
      audioUrl: urlData.publicUrl,
      mensaje: 'Grabación guardada exitosamente'
    })
    
  } catch (error) {
    console.error('❌ Error general:', error)
    res.status(500).json({ error: 'Error interno', details: error.message })
  }
})

// Endpoint para listar grabaciones
app.get('/api/listar', async (req, res) => {
  console.log('📋 Recibida petición GET /api/listar')
  
  try {
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
        hablantes (nombre, dialecto, comunidad)
      `)
      .order('fecha', { ascending: false })
      .limit(50)
    
    if (error) throw error
    
    res.json({ success: true, grabaciones: data || [] })
    
  } catch (error) {
    console.error('❌ Error al listar:', error)
    res.status(500).json({ error: 'Error al listar' })
  }
})

// Endpoint de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor funcionando' })
})

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`)
  console.log(`✅ Endpoints disponibles:`)
  console.log(`   POST http://localhost:${port}/api/grabar`)
  console.log(`   GET  http://localhost:${port}/api/listar`)
  console.log(`   GET  http://localhost:${port}/api/health`)
})