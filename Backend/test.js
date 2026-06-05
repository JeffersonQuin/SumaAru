import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('URL:', supabaseUrl)
console.log('Key existe:', supabaseKey ? 'SÍ' : 'NO')

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  // Primero, listar todos los buckets
  console.log('\n📋 Listando buckets disponibles:')
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  
  if (listError) {
    console.error('❌ Error al listar buckets:', listError.message)
  } else {
    console.log('Buckets encontrados:', buckets.map(b => ({ name: b.name, public: b.public })))
  }
  
  // Intentar subir un archivo
  console.log('\n📤 Intentando subir archivo de prueba...')
  const testBuffer = Buffer.from('test audio content')
  
  const { data, error } = await supabase.storage
    .from('audios')
    .upload(`test-${Date.now()}.txt`, testBuffer)
  
  if (error) {
    console.error('❌ Error al subir:', error.message)
  } else {
    console.log('✅ Subida exitosa:', data)
  }
}

test()