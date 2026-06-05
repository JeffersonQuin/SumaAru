export default function handler(_req, res) {
  res.status(200).json({ status: 'ok', message: 'API en Vercel funcionando' })
}
