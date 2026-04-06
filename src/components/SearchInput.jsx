import { useState, useEffect, useRef, useCallback } from 'react'
import { searchLocations } from '../utils/api'

function LocationIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function SearchInput({ placeholder, label, icon, onSelect, value: externalValue }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleChange = useCallback((e) => {
    const val = e.target.value
    setQuery(val)
    setSelected(false)

    clearTimeout(debounceRef.current)
    if (val.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchLocations(val)
        setResults(data)
        setIsOpen(data.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 380)
  }, [])

  const handleSelect = useCallback((result) => {
    // Show a short label in the input
    const parts = result.display_name.split(',')
    const shortLabel = parts.slice(0, 2).join(',').trim()
    setQuery(shortLabel)
    setResults([])
    setIsOpen(false)
    setSelected(true)
    onSelect({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      label: result.display_name,
    })
  }, [onSelect])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') setIsOpen(false)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
        {icon} {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && !selected && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`w-full bg-slate-700/80 border rounded-xl px-4 py-2.5 pr-10 text-white placeholder-slate-500
            focus:outline-none focus:ring-2 transition-all text-sm
            ${selected
              ? 'border-emerald-500/60 focus:ring-emerald-500/30 focus:border-emerald-400'
              : 'border-slate-600 focus:ring-emerald-500/30 focus:border-emerald-500'
            }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? <Spinner /> : selected ? (
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-[9999] w-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl
          overflow-hidden divide-y divide-slate-700/60 max-h-64 overflow-y-auto">
          {results.map((result, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(result) }}
                className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left text-sm
                  hover:bg-slate-700 transition-colors group"
              >
                <LocationIcon />
                <span className="text-slate-200 group-hover:text-white leading-snug line-clamp-2">
                  {result.display_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
