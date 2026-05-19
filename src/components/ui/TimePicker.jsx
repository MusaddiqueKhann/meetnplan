import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'

const HOUR_GRID = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES   = ['00', '15', '30', '45']
const DROPDOWN_H = 230

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
  const [pos,    setPos]    = useState({})
  const triggerRef  = useRef(null)
  const dropdownRef = useRef(null)

  const amEnabled = HOUR_GRID.some(h => { const h24 = to24(h, 'AM'); return h24 >= minHour && h24 < maxHour })
  const pmEnabled = HOUR_GRID.some(h => { const h24 = to24(h, 'PM'); return h24 >= minHour && h24 < maxHour })

  function isHourAllowed(h) {
    const h24 = to24(h, period)
    return h24 >= minHour && h24 < maxHour
  }

  useEffect(() => {
    const handler = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const onReflow = () => {
      if (triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect()))
    }
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => { window.removeEventListener('scroll', onReflow, true); window.removeEventListener('resize', onReflow) }
  }, [open])

  useEffect(() => {
    if (period === 'AM' && !amEnabled && pmEnabled) setPeriod('PM')
    if (period === 'PM' && !pmEnabled && amEnabled) setPeriod('AM')
  }, [amEnabled, pmEnabled, period])

  function calcPos(rect) {
    const openUp = dropUp || (window.innerHeight - rect.bottom < DROPDOWN_H && rect.top >= DROPDOWN_H)
    return openUp
      ? { bottom: window.innerHeight - rect.top + 6, left: rect.left, width: rect.width }
      : { top: rect.bottom + 6, left: rect.left, width: rect.width }
  }

  const toggle = () => {
    if (!open && triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect()))
    setOpen(o => !o)
  }

  const { h: selH, m: selM, period: selPeriod } = parse(value)

  const emit = (h, m, p) => {
    const h24 = to24(h, p)
    onChange({ target: { value: `${String(h24).padStart(2, '0')}:${m}` } })
  }

  const pickHour   = (h) => { if (!isHourAllowed(h)) return; emit(h, selM || '00', period) }
  const pickMin    = (m) => { if (!selH) return; emit(selH, m, period) }
  const pickPeriod = (p) => {
    if (p === 'AM' && !amEnabled) return
    if (p === 'PM' && !pmEnabled) return
    setPeriod(p)
    if (selH) emit(selH, selM || '00', p)
  }

  const display = value
    ? (() => { const { h, m, period: p } = parse(value); return `${String(h).padStart(2, '0')}:${m} ${p}` })()
    : null

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', zIndex: 9999, ...pos }}
      className="bg-white rounded-2xl border border-[#E8E8E8] shadow-[0_12px_40px_-4px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      {/* Preview bar */}
      <div className="bg-[#0A0A0A] px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between">
          {/* Time display */}
          <div className="flex items-baseline gap-0.5">
            <span className="text-[28px] font-black text-white tabular-nums leading-none tracking-tight">
              {selH ? String(selH).padStart(2, '0') : '--'}
            </span>
            <span className="text-[22px] font-black text-white/25 leading-none mx-0.5">:</span>
            <span className="text-[28px] font-black text-white tabular-nums leading-none tracking-tight">
              {selM ?? '--'}
            </span>
          </div>
          {/* AM / PM pill */}
          <div className="flex bg-white/[0.08] rounded-xl p-0.5">
            {['AM', 'PM'].map(p => {
              const disabled = p === 'AM' ? !amEnabled : !pmEnabled
              const active   = period === p
              return (
                <button key={p} type="button" onClick={() => pickPeriod(p)} disabled={disabled}
                  className={`px-3 py-1 rounded-[10px] text-[11px] font-bold tracking-wide transition-all
                    ${disabled  ? 'text-white/15 cursor-not-allowed'
                    : active    ? 'bg-white text-black shadow-sm'
                    :             'text-white/40 hover:text-white/70'}`}>
                  {p}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="p-2.5 flex flex-col gap-2">
        {/* Hour grid */}
        <div>
          <p className="text-[9px] font-extrabold text-neutral-300 uppercase tracking-[0.12em] mb-1.5 px-1">Hour</p>
          <div className="grid grid-cols-4 gap-1">
            {HOUR_GRID.map(h => {
              const allowed  = isHourAllowed(h)
              const selected = selH === h && selPeriod === period
              return (
                <button key={h} type="button" onClick={() => pickHour(h)} disabled={!allowed}
                  className={`py-2 rounded-xl text-[13px] font-semibold transition-all
                    ${!allowed  ? 'text-neutral-200 cursor-not-allowed'
                    : selected  ? 'bg-black text-white shadow-sm'
                    :             'text-neutral-600 hover:bg-neutral-100 hover:text-black'}`}>
                  {String(h).padStart(2, '0')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-100 mx-1" />

        {/* Minute row */}
        <div>
          <p className="text-[9px] font-extrabold text-neutral-300 uppercase tracking-[0.12em] mb-1.5 px-1">Minute</p>
          <div className="grid grid-cols-4 gap-1">
            {MINUTES.map(m => (
              <button key={m} type="button" onClick={() => pickMin(m)}
                className={`py-2 rounded-xl text-[13px] font-semibold transition-all
                  ${selM === m ? 'bg-black text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-black'}`}>
                :{m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={toggle}
        className={`w-full px-3.5 py-2.5 rounded-xl text-sm flex items-center justify-between transition-all cursor-pointer outline-none border
          ${open ? 'bg-white border-black shadow-sm' : 'bg-[#F7F7F7] border-[#E8E8E8] hover:border-[#C8C8C8] hover:bg-white'}`}
      >
        <span className={`text-[13px] font-medium ${display ? 'text-black' : 'text-[#BABABA]'}`}>
          {display || 'Select time'}
        </span>
        <Clock size={13} className={open ? 'text-black' : 'text-[#C0C0C0]'} />
      </button>

      {open && createPortal(dropdown, document.body)}

      {required && (
        <input type="text" required readOnly value={value || ''} tabIndex={-1} className="sr-only" aria-hidden />
      )}
    </div>
  )
}
