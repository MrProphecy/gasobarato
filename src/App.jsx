import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import SearchInput from './components/SearchInput'
import MapView from './components/MapView'
import StationList from './components/StationList'
import { fetchRoute, fetchStations, fetchWeather, fetchRadares, fetchTCA, fetchChargePoints } from './utils/api'
import { filterStationsByRoute, parsePriceES, distanceToRouteKm } from './utils/geo'

// ── Vehicle types ─────────────────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { id: 'moto_s',   label: 'Moto pequeña',   consumption: 3.5 },
  { id: 'moto_l',   label: 'Moto grande',     consumption: 5.5 },
  { id: 'urban',    label: 'Urbano/Pequeño',  consumption: 6.0 },
  { id: 'turismo',  label: 'Turismo Mixto',   consumption: 7.0 },
  { id: 'suv',      label: 'SUV/Crossover',   consumption: 9.0 },
  { id: 'van',      label: 'Furgoneta/MPV',   consumption: 11.0 },
  { id: 'truck_l',  label: 'Camión ligero',   consumption: 15.0 },
  { id: 'truck_h',  label: 'Camión pesado',   consumption: 28.0 },
  { id: 'hybrid',   label: 'Híbrido',         consumption: 4.0 },
  { id: 'electric', label: '⚡ Eléctrico',    consumption: 0 },
]

// ── Fuel type definitions (Ministry API field names) ─────────────────────────
const FUEL_TYPES = [
  { id: 'g95',    label: 'Gasolina 95',  key: 'Precio Gasolina 95 E5',                    emoji: '🟢' },
  { id: 'g98',    label: 'Gasolina 98',  key: 'Precio Gasolina 98 E5',                    emoji: '🔵' },
  { id: 'diesel', label: 'Diésel',       key: 'Precio Gasoleo A',                          emoji: '🟡' },
  { id: 'glp',    label: 'GLP',          key: 'Precio Gases licuados del petróleo',        emoji: '⚪' },
]

// ── Small icons ───────────────────────────────────────────────────────────────
function FromIcon() {
  return (
    <svg className="w-3.5 h-3.5 inline mr-1 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
    </svg>
  )
}
function ToIcon() {
  return (
    <svg className="w-3.5 h-3.5 inline mr-1 text-red-400" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2a6 6 0 00-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 00-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  )
}

// ── Loading overlay ───────────────────────────────────────────────────────────
function LoadingBar({ stage }) {
  const stages = [
    'Calculando ruta…',
    'Descargando gasolineras…',
    'Filtrando por distancia…',
  ]
  return (
    <div className="flex items-center gap-3 mt-3 p-3 bg-slate-700/60 rounded-xl border border-slate-600">
      <svg className="w-5 h-5 text-emerald-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <div>
        <p className="text-slate-200 text-sm font-medium">{stages[stage] ?? 'Procesando…'}</p>
        <div className="flex gap-1 mt-1.5">
          {stages.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i <= stage ? 'bg-emerald-500 w-12' : 'bg-slate-600 w-6'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Weather widget ────────────────────────────────────────────────────────────
function WeatherBadge({ weather }) {
  if (!weather) return null
  const temp = Math.round(weather.main.temp)
  const desc = weather.weather[0].description
  const icon = weather.weather[0].icon
  const city = weather.name
  return (
    <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-slate-700/50 border border-slate-600/60 rounded-xl">
      <img
        src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
        alt={desc}
        className="w-10 h-10 shrink-0"
      />
      <div className="min-w-0">
        <p className="text-xs text-slate-400 truncate">{city} — {desc}</p>
        <p className="text-lg font-bold text-white leading-tight">{temp}°C</p>
      </div>
    </div>
  )
}

// ── TradingView Brent widget ──────────────────────────────────────────────────
function TradingViewWidget() {
  const containerRef = useRef(null)
  const scriptAdded = useRef(false)

  useEffect(() => {
    if (scriptAdded.current || !containerRef.current) return
    scriptAdded.current = true

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: 'TVC:UKOIL',
      width: '100%',
      height: 200,
      locale: 'es',
      dateRange: '1M',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
    })
    containerRef.current.appendChild(script)
  }, [])

  return (
    <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🛢️</span>
        <h2 className="text-sm font-semibold text-slate-200">Petróleo Brent · TVC:UKOIL</h2>
        <span className="ml-auto text-[10px] text-slate-500 px-2 py-0.5 bg-slate-700 rounded-md">TradingView</span>
      </div>
      <div className="tradingview-widget-container" ref={containerRef}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  )
}

// ── Visit counter ─────────────────────────────────────────────────────────────
function VisitCounter() {
  const [count, setCount] = useState(null)
  useEffect(() => {
    fetch('https://api.counterapi.dev/v1/gasobarato/visits/up')
      .then(r => r.json())
      .then(d => setCount(d.count ?? d.value ?? null))
      .catch(() => {})
  }, [])
  if (count === null) return null
  return (
    <span className="inline-flex items-center gap-1">
      <span>👁</span>
      <span>{count.toLocaleString('es-ES')}</span>
    </span>
  )
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="px-2 py-1 bg-slate-700 rounded-md font-mono text-xs tabular-nums text-slate-200">
      {time.toLocaleTimeString('es-ES')}
    </span>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [origin, setOrigin]           = useState(null)
  const [destination, setDestination] = useState(null)
  const [fuelType, setFuelType]       = useState(FUEL_TYPES[0])
  const [route, setRoute]             = useState(null)
  const [stations, setStations]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [loadStage, setLoadStage]     = useState(0)
  const [error, setError]             = useState(null)
  const [selectedStation, setSelectedStation] = useState(null)
  const [brandFilter, setBrandFilter] = useState('')
  const [weather, setWeather]         = useState(null)
  const [radares, setRadares]         = useState([])
  const [radaresLoading, setRadaresLoading] = useState(false)
  const [showRadares, setShowRadares] = useState(true)
  const [tcaSites, setTcaSites]       = useState([])
  const [vehicleType, setVehicleType] = useState(VEHICLE_TYPES[3]) // Turismo Mixto
  const [consumption, setConsumption] = useState(7.0)
  const [chargePoints, setChargePoints]     = useState([])
  const [showChargePoints, setShowChargePoints] = useState(false)
  const [chargeLoading, setChargeLoading]   = useState(false)

  const handleVehicleChange = useCallback((id) => {
    const v = VEHICLE_TYPES.find(vt => vt.id === id)
    if (!v) return
    setVehicleType(v)
    setConsumption(v.consumption)
    if (v.id === 'electric') setShowChargePoints(true)
  }, [])

  const handleSearch = useCallback(async () => {
    if (!origin || !destination) return
    setLoading(true)
    setError(null)
    setStations([])
    setRoute(null)
    setSelectedStation(null)
    setBrandFilter('')
    setWeather(null)
    setRadares([])
    setTcaSites([])
    setChargePoints([])

    try {
      // Stage 0 – route
      setLoadStage(0)
      const routeData = await fetchRoute(origin, destination)
      setRoute(routeData)

      // Radares DGT (non-blocking, parallel)
      setRadaresLoading(true)
      fetchRadares()
        .then(all => {
          const near = all.filter(r => distanceToRouteKm(r.lat, r.lon, routeData.coordinates) <= 3)
          setRadares(near)
        })
        .catch(() => {})
        .finally(() => setRadaresLoading(false))

      // Charge points (non-blocking, parallel)
      setChargeLoading(true)
      {
        let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
        for (const [lat, lon] of routeData.coordinates) {
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
          if (lon < minLon) minLon = lon
          if (lon > maxLon) maxLon = lon
        }
        fetchChargePoints({ minLat, maxLat, minLon, maxLon })
          .then(points => {
            const near = (Array.isArray(points) ? points : []).filter(p => {
              const lat = p.AddressInfo?.Latitude
              const lon = p.AddressInfo?.Longitude
              if (lat == null || lon == null) return false
              return distanceToRouteKm(lat, lon, routeData.coordinates) <= 5
            })
            setChargePoints(near)
          })
          .catch(() => {})
          .finally(() => setChargeLoading(false))
      }

      // TCA silently
      fetchTCA()
        .then(all => {
          const near = all.filter(s => distanceToRouteKm(s.lat, s.lon, routeData.coordinates) <= 3)
          setTcaSites(near)
        })
        .catch(() => {})

      // Stage 1 – stations
      setLoadStage(1)
      const allStations = await fetchStations()

      // Stage 2 – filter
      setLoadStage(2)
      await new Promise(r => setTimeout(r, 0)) // yield to UI
      const nearby = filterStationsByRoute(allStations, routeData.coordinates, 5)
      setStations(nearby)

      // Weather for origin (non-blocking)
      fetchWeather(origin.lat, origin.lng).then(setWeather).catch(() => {})
    } catch (err) {
      setError(err.message || 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [origin, destination])

  // All brands from route-filtered stations (before brand filter)
  const brands = useMemo(() => {
    const set = new Set(stations.map(s => s['Rótulo']?.trim()).filter(Boolean))
    return [...set].sort()
  }, [stations])

  // Sort stations by selected fuel price (ascending), apply brand filter
  const sortedStations = useMemo(() =>
    stations
      .filter(s => parsePriceES(s[fuelType.key]) > 0)
      .filter(s => !brandFilter || s['Rótulo']?.trim() === brandFilter)
      .sort((a, b) => parsePriceES(a[fuelType.key]) - parsePriceES(b[fuelType.key])),
  [stations, fuelType, brandFilter])

  const canSearch = origin && destination && !loading

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* ── Header ── */}
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700/70 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">⛽</span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-emerald-400 leading-none">
              GasoBarato
            </h1>
            <p className="text-[11px] text-slate-500 leading-none mt-0.5">Gasolineras baratas en tu ruta · España</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <a
              href="https://ko-fi.com/pedroruiz7313"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-semibold transition-colors text-xs"
            >
              ☕ Invítame un Café
            </a>
            <span className="hidden sm:inline">Datos:</span>
            <span className="px-2 py-1 bg-slate-700 rounded-md">MINETUR</span>
            <span className="px-2 py-1 bg-slate-700 rounded-md">OSM</span>
            <Clock />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-4 flex flex-col gap-4">
        {/* ── Search panel ── */}
        <section className="bg-slate-800/70 border border-slate-700 rounded-2xl p-4 shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <SearchInput
                label="Origen"
                icon={<FromIcon />}
                placeholder="Ciudad o dirección de salida…"
                onSelect={setOrigin}
              />
              {/* Weather badge appears below origin */}
              <WeatherBadge weather={weather} />
            </div>
            <SearchInput
              label="Destino"
              icon={<ToIcon />}
              placeholder="Ciudad o dirección de llegada…"
              onSelect={setDestination}
            />
          </div>

          {/* Fuel type tabs */}
          <div className="flex flex-wrap gap-2 mb-3">
            {FUEL_TYPES.map(ft => (
              <button
                key={ft.id}
                type="button"
                onClick={() => setFuelType(ft)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold
                  transition-all border
                  ${fuelType.id === ft.id
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white'
                  }`}
              >
                <span>{ft.emoji}</span>
                {ft.label}
              </button>
            ))}
          </div>

          {/* Vehicle type + consumption */}
          <div className="flex gap-2 mb-3">
            <select
              value={vehicleType.id}
              onChange={(e) => handleVehicleChange(e.target.value)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200
                focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 cursor-pointer"
            >
              {VEHICLE_TYPES.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2">
              <input
                type="number"
                min="0"
                max="60"
                step="0.1"
                value={consumption}
                onChange={(e) => setConsumption(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-14 bg-transparent text-slate-200 text-sm text-right focus:outline-none"
              />
              <span className="text-slate-400 text-xs shrink-0">L/100km</span>
            </div>
          </div>

          {/* Search button */}
          <button
            type="button"
            onClick={handleSearch}
            disabled={!canSearch}
            className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
              ${canSearch
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 active:scale-[0.98]'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Buscando…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Buscar gasolineras baratas
              </>
            )}
          </button>

          {/* Progress */}
          {loading && <LoadingBar stage={loadStage} />}

          {/* Layer toggles – visible after search */}
          {(radaresLoading || chargeLoading || (route && (radares.length > 0 || chargePoints.length > 0))) && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700/60">
              <span className="text-xs text-slate-500">Capas:</span>

              {/* Radar toggle */}
              {(radaresLoading || radares.length > 0) && (
                <button
                  type="button"
                  onClick={() => setShowRadares(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                    showRadares
                      ? 'bg-red-900/40 border-red-700/70 text-red-300 hover:bg-red-900/60'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  📷 Radares DGT
                  {radaresLoading ? (
                    <svg className="w-3 h-3 animate-spin ml-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <span className="text-slate-500">({radares.length})</span>
                  )}
                </button>
              )}

              {/* Charge points toggle */}
              {(chargeLoading || chargePoints.length > 0) && (
                <button
                  type="button"
                  onClick={() => setShowChargePoints(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                    showChargePoints
                      ? 'bg-green-900/40 border-green-700/70 text-green-300 hover:bg-green-900/60'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  ⚡ Recarga eléctrica
                  {chargeLoading ? (
                    <svg className="w-3 h-3 animate-spin ml-1" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <span className="text-slate-500">({chargePoints.length})</span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-start gap-2.5 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* ── Results ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 flex-1">
          {/* Station list */}
          <StationList
            stations={sortedStations}
            fuelType={fuelType}
            route={route}
            selectedStation={selectedStation}
            onSelectStation={setSelectedStation}
            brands={brands}
            brandFilter={brandFilter}
            onBrandFilter={setBrandFilter}
            consumption={consumption}
          />

          {/* Map */}
          <MapView
            origin={origin}
            destination={destination}
            route={route}
            stations={sortedStations}
            fuelType={fuelType}
            selectedStation={selectedStation}
            onSelectStation={setSelectedStation}
            radares={radares}
            showRadares={showRadares}
            tcaSites={tcaSites}
            chargePoints={chargePoints}
            showChargePoints={showChargePoints}
          />
        </div>

        {/* ── TradingView Brent widget ── */}
        <TradingViewWidget />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-3 text-center text-xs text-slate-600 flex flex-wrap justify-center items-center gap-x-3 gap-y-1 px-4">
        <span>Precios: Ministerio de Industria · Rutas: OpenRouteService · Mapas: OSM/CARTO · Clima: OpenWeatherMap</span>
        <span className="text-slate-700">·</span>
        <VisitCounter />
      </footer>
    </div>
  )
}
