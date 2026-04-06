/** Parse Spanish decimal format: "1,359" → 1.359 */
export function parsePriceES(str) {
  if (!str || str.trim() === '') return 0
  return parseFloat(str.replace(',', '.')) || 0
}

/** Parse Spanish coordinate: "40,376389" → 40.376389 */
export function parseCoordES(str) {
  if (!str || str.trim() === '') return null
  const val = parseFloat(str.replace(',', '.'))
  return isNaN(val) ? null : val
}

/** Haversine great-circle distance in km */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Minimum distance from point P to the segment A–B.
 * Uses Euclidean interpolation in lat/lon space (fine for short segments)
 * then haversine for the final metric.
 */
function pointToSegmentKm(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return haversineKm(px, py, ax, ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return haversineKm(px, py, ax + t * dx, ay + t * dy)
}

/** Minimum distance from (lat, lon) to any segment of the route polyline. */
export function distanceToRouteKm(lat, lon, routePoints) {
  let minDist = Infinity
  for (let i = 0; i < routePoints.length - 1; i++) {
    const [lat1, lon1] = routePoints[i]
    const [lat2, lon2] = routePoints[i + 1]
    const d = pointToSegmentKm(lat, lon, lat1, lon1, lat2, lon2)
    if (d < minDist) minDist = d
  }
  return minDist
}

/**
 * Filter stations from the Ministry API to those within maxDistKm of the route.
 * Adds _lat, _lon, _distKm fields to each station.
 */
export function filterStationsByRoute(stations, routePoints, maxDistKm = 5) {
  // Pre-compute bounding box of route + padding to skip obvious misses fast
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
  for (const [lat, lon] of routePoints) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }
  const PAD = maxDistKm / 111 // ~1° lat ≈ 111 km
  minLat -= PAD; maxLat += PAD; minLon -= PAD; maxLon += PAD

  const result = []
  for (const station of stations) {
    const lat = parseCoordES(station['Latitud'])
    const lon = parseCoordES(station['Longitud (WGS84)'])
    if (lat === null || lon === null) continue

    // Bounding box pre-filter
    if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) continue

    const dist = distanceToRouteKm(lat, lon, routePoints)
    if (dist > maxDistKm) continue

    result.push({ ...station, _lat: lat, _lon: lon, _distKm: dist })
  }
  return result
}

export function formatDistance(meters) {
  const km = meters / 1000
  return km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
