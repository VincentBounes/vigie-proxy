// VIGIE — Proxy hélicoptères Vercel
// Route : GET /api/helicopters?lat=43.6047&lng=1.4442&dist=81
// Déployer sur Vercel — gratuit, zéro config

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

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

    // Filtre élargi — le registre VIGIE fait le tri fin côté client
    // On retient tout ce qui pourrait être un hélico :
    // catégorie A7 (ADSB officiel hélicoptère)
    // type commençant par H, EC, AS, AW, BO, BK, MD, R4, R6, S6, S7, S9
    // callsign SAMU/SMUR/DRAGON/CHOUCAS/GEND/POLIC/RESCUE/LIFEG
    // immat française F-H (hélico civil français — range ICAO 3C4000-3C7FFF)
    // ou pas de type du tout mais altitude basse (probablement hélico non taggé)
    const HELI_TYPES = ['H','EC','AS','AW','BO','BK','MD','R4','R6','S6','S7','S9','SK','CH','NH','MI']
    const HELI_CS    = ['SAMU','SMUR','DRAGON','CHOUCAS','GEND','POLIC','RESCUE','LIFEG','HELIAIR']

    const helicos = all.filter(a => {
      if (a.category === 'A7') return true
      const t  = (a.t      || '').toUpperCase().trim()
      const cs = (a.flight || '').toUpperCase().trim()
      const r  = (a.r      || '').toUpperCase().trim()
      if (t && HELI_TYPES.some(p => t.startsWith(p))) return true
      if (cs && HELI_CS.some(p => cs.startsWith(p))) return true
      // Immat française hélico civil : F-H... → hex 3c4xxx à 3c7xxx
      if (r.startsWith('F-H')) return true
      const hex = (a.hex || '').toLowerCase()
      if (hex >= '3c4000' && hex <= '3c7fff') return true
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
