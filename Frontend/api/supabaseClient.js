import { createClient } from '@supabase/supabase-js'

export const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL
export const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY

export function assertSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Faltan variables SUPABASE_URL y SUPABASE_ANON_KEY (o VITE_*) en Vercel'
    )
  }
  if (!supabaseUrl.includes('supabase.co')) {
    throw new Error('VITE_SUPABASE_URL no es una URL válida de Supabase')
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'invalid'
)
