const ORS_API_KEY =
  'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjBkNTkyMTVkNTYzYzQ1NzRhMmYxMDVkMWM5N2M3MWE4IiwiaCI6Im11cm11cjY0In0='

const MINETUR_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/'

// ── Nominatim autocomplete ──────────────────────────────────────────────────
export async function searchLocations(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    countrycodes: 'es',
    limit: '6',
    addressdetails: '1',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'es-ES,es', 'User-Agent': 'GasoBarato/1.0' },
  })
  if (!res.ok) throw new Error('Error buscando ubicación')
  return res.json()
}

// ── OpenRouteService route ──────────────────────────────────────────────────
export async function fetchRoute(origin, destination) {
  const res = await fetch(
    'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
    {
      method: 'POST',
      headers: {
        Authorization: ORS_API_KEY,
        'Content-Type': 'application/json',
        Accept:
          'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      }),
    },
  )

  if (!res.ok) {
    let msg = `Error ${res.status} calculando ruta`
    try {
      const body = await res.json()
      msg = body?.error?.message || msg
    } catch {}
    throw new Error(msg)
  }

  const data = await res.json()
  const feature = data.features[0]
  // ORS returns [lng, lat] — convert to [lat, lng] for Leaflet
  const coordinates = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  const { distance, duration } = feature.properties.summary

  return { coordinates, distance, duration }
}

// ── Ministerio API – all stations ───────────────────────────────────────────
export async function fetchStations() {
  const res = await fetch(MINETUR_URL, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Error obteniendo gasolineras (${res.status})`)
  const data = await res.json()
  return data.ListaEESSPrecio ?? []
}
