import { parsePriceES, formatDistance, formatDuration } from '../utils/geo'

const MEDAL = ['🥇', '🥈', '🥉']

function RouteStats({ route }) {
  if (!route) return null
  return (
    <div className="flex gap-4 px-4 py-3 bg-emerald-950/60 border-b border-slate-700">
      <div className="flex items-center gap-1.5 text-sm">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <span className="text-slate-200 font-semibold">{formatDistance(route.distance)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-slate-200 font-semibold">{formatDuration(route.duration)}</span>
      </div>
    </div>
  )
}

function EmptyState({ hasRoute }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-500 px-6 text-center">
      <svg className="w-14 h-14 mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      {hasRoute ? (
        <>
          <p className="font-medium text-slate-400">Sin gasolineras en ruta</p>
          <p className="text-xs mt-1">No hay estaciones a menos de 5 km del trayecto para el combustible seleccionado.</p>
        </>
      ) : (
        <>
          <p className="font-medium text-slate-400">Introduce tu ruta</p>
          <p className="text-xs mt-1">Elige origen y destino para encontrar las gasolineras más baratas.</p>
        </>
      )}
    </div>
  )
}

function PriceBadge({ price, rank }) {
  const colors =
    rank === 0 ? 'bg-emerald-500 text-white'
    : rank === 1 ? 'bg-amber-500 text-white'
    : rank === 2 ? 'bg-orange-600/80 text-white'
    : 'bg-slate-600 text-slate-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-lg text-sm font-bold tabular-nums ${colors}`}>
      {price.toFixed(3)} €
    </span>
  )
}

export default function StationList({ stations, fuelType, route, selectedStation, onSelectStation }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 shrink-0">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          {stations.length > 0 ? `${stations.length} gasolineras` : 'Gasolineras'}
        </h2>
        {stations.length > 0 && (
          <p className="text-xs text-slate-400 mt-0.5">
            Ordenadas por precio · {fuelType.label} · ≤ 5 km de la ruta
          </p>
        )}
      </div>

      <RouteStats route={route} />

      {/* List */}
      <div className="overflow-y-auto flex-1" style={{ maxHeight: '560px' }}>
        {stations.length === 0 ? (
          <EmptyState hasRoute={!!route} />
        ) : (
          stations.map((station, idx) => {
            const price = parsePriceES(station[fuelType.key])
            const isSelected = selectedStation?._lat === station._lat && selectedStation?._lon === station._lon
            const label = station['Rótulo']?.trim() || 'Estación sin nombre'
            const locality = [station['Localidad'], station['Municipio']]
              .filter(Boolean)
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(', ')

            return (
              <button
                key={`${station._lat}-${station._lon}-${idx}`}
                type="button"
                onClick={() => onSelectStation(isSelected ? null : station)}
                className={`w-full text-left px-3.5 py-3 border-b border-slate-700/70
                  hover:bg-slate-700/60 transition-colors group
                  ${isSelected ? 'bg-slate-700/80 border-l-[3px] border-l-emerald-500 pl-[13px]' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Rank + info */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className={`shrink-0 text-base leading-none mt-0.5
                      ${idx < 3 ? '' : 'text-slate-500 text-xs font-bold w-5 text-center'}`}>
                      {idx < 3 ? MEDAL[idx] : idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-100 text-sm truncate group-hover:text-white">
                        {label}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{locality}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{station['Dirección']}</p>
                    </div>
                  </div>

                  {/* Price + distance */}
                  <div className="shrink-0 text-right">
                    <PriceBadge price={price} rank={idx} />
                    <p className="text-xs text-slate-500 mt-1">{station._distKm.toFixed(1)} km</p>
                  </div>
                </div>

                {/* Horario */}
                {station['Horario'] && (
                  <p className="ml-8 mt-1 text-xs text-slate-500 truncate">
                    <span className="mr-1">🕐</span>{station['Horario']}
                  </p>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
