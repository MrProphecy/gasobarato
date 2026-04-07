import { useEffect, useRef, useCallback } from 'react'
import {
  MapContainer, TileLayer, Polyline, Marker, Popup, useMap, CircleMarker,
} from 'react-leaflet'
import L from 'leaflet'
import { parsePriceES } from '../utils/geo'

// ── Fix default Leaflet icon URLs broken by bundlers ─────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Charge point icon ─────────────────────────────────────────────────────────
const chargeIcon = L.divIcon({
  className: '',
  html: `<div style="
    background:#16a34a;
    color:white;
    border:2px solid #4ade80;
    border-radius:6px;
    width:28px;height:28px;
    display:flex;align-items:center;justify-content:center;
    font-size:14px;
    box-shadow:0 2px 8px rgba(22,163,74,0.6);
    cursor:pointer;
  ">⚡</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
})

// ── Radar icon ────────────────────────────────────────────────────────────────
const radarIcon = L.divIcon({
  className: '',
  html: `<div style="
    background:#dc2626;
    color:white;
    border:2px solid #fca5a5;
    border-radius:6px;
    width:28px;height:28px;
    display:flex;align-items:center;justify-content:center;
    font-size:14px;
    box-shadow:0 2px 8px rgba(220,38,38,0.6);
    cursor:pointer;
  ">📷</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
})

// ── Price pin icon ────────────────────────────────────────────────────────────
function makePriceIcon(price, rank, isSelected = false) {
  if (isSelected) {
    return L.divIcon({
      className: '',
      html: `<div style="position:relative;display:inline-block;">
        <div style="position:absolute;inset:-8px;border-radius:50%;border:3px solid #3b82f6;opacity:0.6;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;pointer-events:none"></div>
        <div style="
          background:#1d4ed8;
          color:white;
          border:3px solid #93c5fd;
          border-radius:50%;
          width:46px;height:46px;
          display:flex;align-items:center;justify-content:center;
          font-size:9.5px;font-weight:700;
          box-shadow:0 3px 14px rgba(59,130,246,0.7);
          position:relative;
          font-family:monospace;
          letter-spacing:-0.5px;
        ">${price.toFixed(3)}</div>
      </div>`,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
      popupAnchor: [0, -26],
    })
  }

  const bg =
    rank === 0 ? '#10b981'   // emerald – cheapest
    : rank === 1 ? '#f59e0b' // amber
    : rank === 2 ? '#ea580c' // orange
    : '#475569'              // slate

  const border = rank === 0 ? '#34d399' : '#fff'
  const pulse = rank === 0
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid #10b981;opacity:0.5;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;pointer-events:none"></div>`
    : ''

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;display:inline-block;">
      ${pulse}
      <div style="
        background:${bg};
        color:white;
        border:2px solid ${border};
        border-radius:50%;
        width:38px;height:38px;
        display:flex;align-items:center;justify-content:center;
        font-size:9.5px;font-weight:700;
        box-shadow:0 3px 8px rgba(0,0,0,0.5);
        position:relative;
        font-family:monospace;
        letter-spacing:-0.5px;
      ">${price.toFixed(3)}</div>
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  })
}

// ── Endpoint marker ───────────────────────────────────────────────────────────
function makeEndpointIcon(type) {
  const bg = type === 'origin' ? '#3b82f6' : '#ef4444'
  const label = type === 'origin' ? 'A' : 'B'
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bg};
      color:white;
      border:3px solid white;
      border-radius:50%;
      width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:800;
      box-shadow:0 3px 10px rgba(0,0,0,0.5);
    ">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

const originIcon = makeEndpointIcon('origin')
const destIcon = makeEndpointIcon('destination')

// ── Bounce map view to route / selected station ───────────────────────────────
function MapController({ route, origin, destination, selectedStation }) {
  const map = useMap()

  useEffect(() => {
    if (selectedStation) {
      map.setView([selectedStation._lat, selectedStation._lon], Math.max(map.getZoom(), 13), {
        animate: true,
      })
      return
    }
    if (route?.coordinates?.length) {
      map.fitBounds(L.latLngBounds(route.coordinates), { padding: [40, 40], animate: true })
      return
    }
    if (origin && destination) {
      map.fitBounds(
        [[origin.lat, origin.lng], [destination.lat, destination.lng]],
        { padding: [60, 60], animate: true },
      )
    }
  }, [route, origin, destination, selectedStation, map])

  return null
}

// ── Popup content ─────────────────────────────────────────────────────────────
function StationPopup({ station, fuelType }) {
  const price = parsePriceES(station[fuelType.key])
  return (
    <div className="min-w-[180px]">
      <p className="font-bold text-slate-100 text-sm leading-tight">
        {station['Rótulo']?.trim() || 'Gasolinera'}
      </p>
      <p className="text-slate-400 text-xs mt-0.5">{station['Dirección']}</p>
      <p className="text-slate-400 text-xs">{station['Localidad']}</p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
        <span className="text-xs text-slate-400">{fuelType.label}</span>
        <span className="text-emerald-400 font-bold text-sm">{price.toFixed(3)} €/L</span>
      </div>
      <p className="text-slate-500 text-xs mt-1">{station._distKm.toFixed(1)} km de la ruta</p>
      {station['Horario'] && (
        <p className="text-slate-500 text-xs mt-0.5 truncate">🕐 {station['Horario']}</p>
      )}
    </div>
  )
}

// ── Charge point popup ────────────────────────────────────────────────────────
function ChargePopup({ point }) {
  const info = point.AddressInfo || {}
  const name = info.Title || 'Punto de recarga'
  const address = [info.AddressLine1, info.Town].filter(Boolean).join(', ')
  const connections = point.Connections || []
  return (
    <div className="min-w-[190px]">
      <p className="font-bold text-green-400 text-sm leading-tight">⚡ {name}</p>
      {address && <p className="text-slate-300 text-xs mt-1">{address}</p>}
      {connections.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {connections.slice(0, 4).map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              {c.ConnectionType?.Title && (
                <span className="text-slate-400 truncate">{c.ConnectionType.Title}</span>
              )}
              {c.PowerKW && (
                <span className="text-green-400 font-bold shrink-0">{c.PowerKW} kW</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Radar popup content ───────────────────────────────────────────────────────
function RadarPopup({ radar }) {
  return (
    <div className="min-w-[160px]">
      <p className="font-bold text-red-400 text-sm leading-tight">📷 Radar fijo DGT</p>
      {radar.road && <p className="text-slate-300 text-xs mt-1 font-semibold">{radar.road}</p>}
      {radar.speed && (
        <p className="text-slate-200 text-xs mt-0.5">
          <span className="text-red-300 font-bold">{radar.speed} km/h</span> velocidad máx.
        </p>
      )}
      {radar.direction && (
        <p className="text-slate-400 text-xs mt-0.5">➡ {radar.direction}</p>
      )}
      {!radar.road && !radar.speed && (
        <p className="text-slate-400 text-xs mt-0.5 break-words max-w-[200px]">{radar.name}</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const SPAIN_CENTER = [40.4, -3.7]

export default function MapView({
  origin, destination, route, stations, fuelType, selectedStation, onSelectStation,
  radares, showRadares, tcaSites, chargePoints, showChargePoints,
}) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden" style={{ height: 620 }}>
      <MapContainer
        center={SPAIN_CENTER}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        preferCanvas={false}
      >
        {/* Dark OSM tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        <MapController
          route={route}
          origin={origin}
          destination={destination}
          selectedStation={selectedStation}
        />

        {/* Route polyline with glow */}
        {route && (
          <>
            <Polyline positions={route.coordinates} color="#065f46" weight={8} opacity={0.4} />
            <Polyline positions={route.coordinates} color="#10b981" weight={3.5} opacity={0.9} />
          </>
        )}

        {/* Origin / Destination markers */}
        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
            <Popup>
              <p className="font-semibold text-slate-100">Origen</p>
              <p className="text-slate-400 text-xs">{origin.label.split(',').slice(0, 2).join(',')}</p>
            </Popup>
          </Marker>
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
            <Popup>
              <p className="font-semibold text-slate-100">Destino</p>
              <p className="text-slate-400 text-xs">{destination.label.split(',').slice(0, 2).join(',')}</p>
            </Popup>
          </Marker>
        )}

        {/* TCA / tramos peligrosos – orange dots */}
        {tcaSites?.map((site, idx) => (
          <CircleMarker
            key={`tca-${idx}`}
            center={[site.lat, site.lon]}
            radius={5}
            pathOptions={{ color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.7, weight: 1.5 }}
          />
        ))}

        {/* Radar markers */}
        {showRadares && radares?.map((radar, idx) => (
          <Marker
            key={`radar-${idx}`}
            position={[radar.lat, radar.lon]}
            icon={radarIcon}
            zIndexOffset={500}
          >
            <Popup>
              <RadarPopup radar={radar} />
            </Popup>
          </Marker>
        ))}

        {/* Charge point markers */}
        {showChargePoints && chargePoints?.map((point, idx) => {
          const lat = point.AddressInfo?.Latitude
          const lon = point.AddressInfo?.Longitude
          if (!lat || !lon) return null
          return (
            <Marker
              key={`charge-${idx}`}
              position={[lat, lon]}
              icon={chargeIcon}
              zIndexOffset={400}
            >
              <Popup>
                <ChargePopup point={point} />
              </Popup>
            </Marker>
          )
        })}

        {/* Station markers */}
        {stations.map((station, idx) => {
          const price = parsePriceES(station[fuelType.key])
          if (!price) return null
          const isSelected =
            selectedStation?._lat === station._lat && selectedStation?._lon === station._lon

          return (
            <Marker
              key={`${station._lat}-${station._lon}-${idx}`}
              position={[station._lat, station._lon]}
              icon={makePriceIcon(price, idx, isSelected)}
              zIndexOffset={isSelected ? 1000 : stations.length - idx}
              eventHandlers={{
                click: () => onSelectStation(isSelected ? null : station),
              }}
            >
              <Popup>
                <StationPopup station={station} fuelType={fuelType} />
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
