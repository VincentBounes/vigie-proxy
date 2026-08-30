// VIGIE — Proxy Overpass Vercel
// Route : POST /api/overpass
// Body : form-encoded "data=<query>" OU JSON { query: "..." }

export const config = {
  api: {
    bodyParser: false, // Lire le body brut pour gérer form-encoded
  },
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')

  const MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
  ]

  let query = ''

  if (req.method === 'POST') {
    const raw = await getRawBody(req)
    // Form-encoded : data=<query>
    if (raw.startsWith('data=')) {
      query = decodeURIComponent(raw.slice(5).replace(/\+/g, ' '))
    } else {
      // Tenter JSON
      try {
        const parsed = JSON.parse(raw)
        query = parsed.query || parsed.data || ''
      } catch(e) {
        query = raw
      }
    }
  } else if (req.method === 'GET') {
    query = req.query.data || req.query.query || ''
  }

  if (!query) {
    res.status(400).json({ ok: false, error: 'query manquante' })
    return
  }

  for (const mirror of MIRRORS) {
    try {
      const resp = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(25000)
      })
      if (resp.ok) {
        const data = await resp.json()
        res.status(200).json(data)
        return
      }
      console.warn(`Overpass ${mirror}: ${resp.status}`)
    } catch(e) {
      console.warn(`Overpass ${mirror} error:`, e.message)
    }
  }

  res.status(503).json({ ok: false, error: 'Tous les miroirs Overpass sont indisponibles' })
}
