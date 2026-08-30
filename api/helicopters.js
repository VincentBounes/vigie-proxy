// VIGIE — Proxy hélicoptères Vercel
// Route : GET /api/helicopters?lat=43.6047&lng=1.4442&dist=81
// Déployer sur Vercel — gratuit, zéro config

export default async function handler(req, res) {
  // CORS — autorise vigie-4ze.pages.dev et tout autre origine
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  // Cache : Vercel garde 15s, navigateur 10s — adsb.lol ne verra qu'une requête/15s
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=10')

  const lat  = req.query.lat  || '43.6047'
  const lng  = req.query.lng  || '1.4442'
  const dist = req.query.dist || '81'

  try {
    const url = `https://api.adsb.lol/v2/lat/${lat}/lon/${lng}/dist/${dist}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VIGIE-SAMU/1.0',
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      res.status(response.status).json({ ok: false, error: `adsb.lol: ${response.status}` })
      return
    }

    const data = await response.json()
    const all = data.ac || []

    // Filtre hélicoptères côté serveur
    const helicos = all.filter(a => {
      if (a.category === 'A7') return true
      const t = (a.t || '').toUpperCase()
      if (t.startsWith('H') || t.startsWith('EC') || t.startsWith('AS3') || t.startsWith('AW')) return true
      const cs = (a.flight || '').trim().toUpperCase()
      if (['SAMU','SMUR','DRAGON','CHOUCAS','GEND','POLIC','RESCUE'].some(p => cs.startsWith(p))) return true
      return false
    })

    res.status(200).json({
      ok: true,
      total: all.length,
      helicos,
      ts: new Date().toISOString()
    })

  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
}
