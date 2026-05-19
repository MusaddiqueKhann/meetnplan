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

export default function TimePicker({ value, onChange, required, minHour = 0, maxHour = 24, dropUp = false, triggerClass }) {
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
    const w = Math.max(rect.width, 200)
    const left = rect.left + rect.width / 2 - w / 2
    return { top: rect.bottom + 8, left: Math.max(8, left), width: w }
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
      className="bg-white rounded-xl border border-[#E4E4E4] shadow-[0_20px_56px_-8px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      {/* Preview bar */}
      <div className="bg-[#111] px-3 py-2 flex items-center justify-between gap-2">
        {/* Time display */}
        <div className="flex items-baseline">
          <span className={`text-[26px] font-black tabular-nums leading-none tracking-tight transition-colors ${selH ? 'text-white' : 'text-white/25'}`}>
            {selH ? String(selH).padStart(2, '0') : '00'}
          </span>
          <span className={`text-[20px] font-black leading-none mx-0.5 transition-colors ${selH && selM != null ? 'text-white/50' : 'text-white/20'}`}>:</span>
          <span className={`text-[26px] font-black tabular-nums leading-none tracking-tight transition-colors ${selM != null ? 'text-white' : 'text-white/25'}`}>
            {selM ?? '00'}
          </span>
        </div>
        {/* AM / PM toggle */}
        <div className="flex bg-white/[0.1] rounded-full p-[3px] gap-0.5 flex-shrink-0">
          {['AM', 'PM'].map(p => {
            const disabled = p === 'AM' ? !amEnabled : !pmEnabled
            const active   = period === p
            return (
              <button key={p} type="button" onClick={() => pickPeriod(p)} disabled={disabled}
                className={`px-2.5 py-[5px] rounded-full text-[10px] font-bold tracking-wider transition-all
                  ${disabled  ? 'text-white/20 cursor-not-allowed'
                  : active    ? 'bg-white text-black shadow-sm'
                  :             'text-white/45 hover:text-white/75'}`}>
                {p}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-2 pt-1.5 pb-1.5 flex flex-col gap-1">
        {/* Hour grid */}
        <div>
          <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-[0.12em] mb-1 px-0.5">Hour</p>
          <div className="grid grid-cols-4 gap-0.5">
            {HOUR_GRID.map(h => {
              const allowed  = isHourAllowed(h)
              const selected = selH === h && selPeriod === period
              return (
                <button key={h} type="button" onClick={() => pickHour(h)} disabled={!allowed}
                  className={`py-1.5 rounded-lg text-[12px] font-semibold transition-all
                    ${!allowed  ? 'text-neutral-300 cursor-not-allowed'
                    : selected  ? 'bg-[#111] text-white shadow-sm'
                    :             'text-neutral-700 hover:bg-neutral-100 hover:text-black'}`}>
                  {String(h).padStart(2, '0')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-100 my-0.5" />

        {/* Minute row */}
        <div>
          <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-[0.12em] mb-1 px-0.5">Minute</p>
          <div className="grid grid-cols-4 gap-0.5">
            {MINUTES.map(m => (
              <button key={m} type="button" onClick={() => pickMin(m)}
                className={`py-1.5 rounded-lg text-[12px] font-semibold transition-all
                  ${selM === m ? 'bg-[#111] text-white shadow-sm' : 'text-neutral-700 hover:bg-neutral-100 hover:text-black'}`}>
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
        className={triggerClass
          ? `${triggerClass} flex items-center justify-between cursor-pointer ${open ? '!border-black !bg-white' : ''}`
          : `w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between transition-all cursor-pointer outline-none border ${open ? 'bg-white border-black shadow-sm' : 'bg-[#F8F8F8] border-transparent hover:bg-[#F0F0F0]'}`
        }
      >
        <span className={`font-medium ${display ? 'text-black' : 'text-[#BBBBBB]'}`}>
          {display || 'Select time'}
        </span>
        <Clock size={triggerClass ? 14 : 12} className={open ? 'text-black' : 'text-[#C8C8C8]'} />
      </button>

      {open && createPortal(dropdown, document.body)}

      {required && (
        <input type="text" required readOnly value={value || ''} tabIndex={-1} className="sr-only" aria-hidden />
      )}
    </div>
  )
}
