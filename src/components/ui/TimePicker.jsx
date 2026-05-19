import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'

// hour grid order: 12, 1–11
const HOUR_GRID = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES   = ['00', '15', '30', '45']

function to24(h, period) {
  if (period === 'AM') return h === 12 ? 0 : h
  return h === 12 ? 12 : h + 12
}

function parse(v) {
  if (!v) return { h: null, m: null, period: 'AM' }
  const [hRaw, mRaw] = v.split(':')
  const hNum   = parseInt(hRaw)
  const period = hNum >= 12 ? 'PM' : 'AM'
  const h      = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum
  return { h, m: mRaw, period }
}

export default function TimePicker({ value, onChange, required, minHour = 0, maxHour = 24, dropUp = false }) {
  const { period: initP } = parse(value)
  const [open,   setOpen]   = useState(false)
  const [period, setPeriod] = useState(initP || 'AM')
  const ref = useRef(null)

  const amEnabled = HOUR_GRID.some(h => { const h24 = to24(h, 'AM'); return h24 >= minHour && h24 < maxHour })
  const pmEnabled = HOUR_GRID.some(h => { const h24 = to24(h, 'PM'); return h24 >= minHour && h24 < maxHour })

  function isHourAllowed(h) {
    const h24 = to24(h, period)
    return h24 >= minHour && h24 < maxHour
  }

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-switch period when the current one becomes fully disabled (e.g. minHour jumps into PM)
  useEffect(() => {
    if (period === 'AM' && !amEnabled && pmEnabled) setPeriod('PM')
    if (period === 'PM' && !pmEnabled && amEnabled) setPeriod('AM')
  }, [amEnabled, pmEnabled, period])

  const { h: selH, m: selM, period: selPeriod } = parse(value)

  const emit = (h, m, p) => {
    const h24 = to24(h, p)
    onChange({ target: { value: `${String(h24).padStart(2, '0')}:${m}` } })
  }

  const pickHour = (h) => {
    if (!isHourAllowed(h)) return
    emit(h, selM || '00', period)
  }

  const pickMin = (m) => {
    if (!selH) return
    emit(selH, m, period)
  }

  const pickPeriod = (p) => {
    if (p === 'AM' && !amEnabled) return
    if (p === 'PM' && !pmEnabled) return
    setPeriod(p)
    if (selH) emit(selH, selM || '00', p)
  }

  const display = value
    ? (() => {
        const { h, m, period: p } = parse(value)
        return `${String(h).padStart(2, '0')}:${m} ${p}`
      })()
    : null

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full px-4 py-3 rounded-2xl text-sm flex items-center justify-between transition-all cursor-pointer outline-none border
          ${open ? 'bg-white border-black' : 'bg-[#F9F9F9] border-[#E5E5E5] hover:border-[#C8C8C8]'}`}
      >
        <span className={display ? 'text-black font-medium' : 'text-[#BBBBBB]'}>
          {display || 'Select time'}
        </span>
        <Clock size={14} className={open ? 'text-black' : 'text-[#BBBBBB]'} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={`absolute left-0 z-[200] w-full bg-white rounded-2xl border border-[#E5E5E5] shadow-[0_8px_32px_-4px_rgba(0,0,0,0.14)] overflow-hidden ${dropUp ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'}`}>

          {/* Preview */}
          <div className="bg-black px-4 py-2.5 flex items-center justify-between">
            <span className="text-lg font-black text-white tabular-nums tracking-tight">
              {selH ? String(selH).padStart(2, '0') : '--'}
              <span className="text-white/30 mx-0.5">:</span>
              {selM ?? '--'}
            </span>
            <div className="flex gap-1">
              {['AM', 'PM'].map(p => (
                <button key={p} type="button" onClick={() => pickPeriod(p)}
                  disabled={p === 'AM' ? !amEnabled : !pmEnabled}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all
                    ${p === 'AM' && !amEnabled || p === 'PM' && !pmEnabled
                      ? 'text-white/20 cursor-not-allowed'
                      : period === p
                        ? 'bg-white text-black'
                        : 'text-white/50 hover:text-white'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 flex flex-col gap-2">
            {/* Hour grid */}
            <div>
              <p className="text-[8px] font-bold text-neutral-300 uppercase tracking-widest mb-1">Hour</p>
              <div className="grid grid-cols-4 gap-1">
                {HOUR_GRID.map(h => {
                  const allowed = isHourAllowed(h)
                  const selected = selH === h && selPeriod === period
                  return (
                    <button key={h} type="button" onClick={() => pickHour(h)}
                      disabled={!allowed}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${!allowed
                          ? 'text-neutral-200 cursor-not-allowed'
                          : selected
                            ? 'bg-black text-white'
                            : 'text-neutral-700 hover:bg-neutral-100'}`}>
                      {String(h).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Minute row */}
            <div>
              <p className="text-[8px] font-bold text-neutral-300 uppercase tracking-widest mb-1">Minute</p>
              <div className="grid grid-cols-4 gap-1">
                {MINUTES.map(m => (
                  <button key={m} type="button" onClick={() => pickMin(m)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${selM === m
                        ? 'bg-black text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'}`}>
                    :{m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {required && (
        <input type="text" required readOnly value={value || ''} tabIndex={-1} className="sr-only" aria-hidden />
      )}
    </div>
  )
}
