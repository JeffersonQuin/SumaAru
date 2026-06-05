import { supabaseUrl, supabaseAnonKey } from './supabaseClient.js'

export default function handler(_req, res) {
  const hasUrl = Boolean(supabaseUrl)
  const hasKey = Boolean(supabaseAnonKey)
  const urlOk = hasUrl && supabaseUrl.includes('supabase.co')

  res.status(hasUrl && hasKey && urlOk ? 200 : 503).json({
    status: hasUrl && hasKey && urlOk ? 'ok' : 'misconfigured',
    message: 'API en Vercel',
    supabaseUrl: hasUrl,
    supabaseKey: hasKey,
    urlValid: urlOk
  })
}
