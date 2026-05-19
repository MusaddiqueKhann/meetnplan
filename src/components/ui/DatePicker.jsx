import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

const MONTHS       = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS         = ['S','M','T','W','T','F','S']

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DatePicker({ value, onChange, required, minDate, maxDate, offDays = [5, 6] }) {
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => {
    const b = value ? new Date(value + 'T00:00:00') : today
    return new Date(b.getFullYear(), b.getMonth(), 1)
  })
  const [pos, setPos] = useState({})
  const triggerRef  = useRef(null)
  const dropdownRef = useRef(null)

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

  function calcPos(rect) {
    const w = Math.max(rect.width, 200)
    const left = rect.left + rect.width / 2 - w / 2
    return { top: rect.bottom + 8, left: Math.max(8, left), width: w }
  }

  const toggle = () => {
    if (!open && triggerRef.current)
      setPos(calcPos(triggerRef.current.getBoundingClientRect()))
    setOpen(o => !o)
  }

  const selected = value ? new Date(value + 'T00:00:00') : null
  const year     = view.getFullYear()
  const month    = view.getMonth()

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev  = new Date(year, month, 0).getDate()
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const cells = []
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, cur: false, date: new Date(year, month - 1, daysInPrev - i) })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, cur: true, date: new Date(year, month, d) })
  while (cells.length < totalCells) {
    const d = cells.length - firstDay - daysInMonth + 1
    cells.push({ day: d, cur: false, date: new Date(year, month + 1, d) })
  }

  const isDisabled = (d) => {
    const s = localStr(d)
    return (minDate && s < minDate) || (maxDate && s > maxDate) || offDays.includes(d.getDay())
  }

  const pick = (date) => {
    if (isDisabled(date)) return
    onChange({ target: { value: localStr(date) } })
    setOpen(false)
  }

  const isSel = (d) => selected && d.toDateString() === selected.toDateString()
  const isTod = (d) => d.toDateString() === today.toDateString()
  const todayDisabled = isDisabled(today)

  const display = selected
    ? selected.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', zIndex: 9999, ...pos }}
      className="bg-white rounded-xl border border-[#E4E4E4] shadow-[0_20px_56px_-8px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      {/* Dark preview bar — mirrors TimePicker */}
      <div className="bg-[#111] px-3 py-2 flex items-center justify-between gap-2">
        {/* Selected date display */}
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[26px] font-black tabular-nums leading-none tracking-tight transition-colors ${selected ? 'text-white' : 'text-white/25'}`}>
            {selected ? String(selected.getDate()).padStart(2, '0') : '--'}
          </span>
          <div className="flex flex-col justify-end pb-0.5 gap-[2px]">
            <span className={`text-[11px] font-bold leading-none transition-colors ${selected ? 'text-white' : 'text-white/25'}`}>
              {selected ? MONTHS_SHORT[selected.getMonth()] : 'Mon'}
            </span>
            <span className={`text-[9px] font-medium leading-none transition-colors ${selected ? 'text-white/55' : 'text-white/20'}`}>
              {selected ? selected.getFullYear() : '0000'}
            </span>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button type="button" onClick={() => setView(new Date(year, month - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <ChevronLeft size={11} strokeWidth={2.5} />
          </button>
          <span className="text-[10px] font-bold text-white/75 min-w-[64px] text-center tabular-nums">
            {MONTHS_SHORT[month]} {year}
          </span>
          <button type="button" onClick={() => setView(new Date(year, month + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <ChevronRight size={11} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="px-2 pt-1.5 pb-1.5">
        {/* Day-of-week labels */}
        <div className="grid grid-cols-7 mb-0.5">
          {DAYS.map((d, i) => (
            <div key={i} className="h-4 flex items-center justify-center text-[8px] font-bold text-neutral-400 uppercase tracking-[0.06em]">
              {d}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map(({ day, cur, date }, i) => {
            const sel = isSel(date)
            const tod = isTod(date)
            const dis = isDisabled(date)
            return (
              <div key={i} className="flex items-center justify-center">
                <button type="button" onClick={() => pick(date)} disabled={dis}
                  className={[
                    'w-[22px] h-[22px] rounded-full text-[10px] font-semibold transition-all flex items-center justify-center',
                    dis         ? 'text-neutral-300 cursor-not-allowed'                                          :
                    sel         ? 'bg-[#111] text-white font-bold cursor-pointer shadow-sm'                      :
                    tod && !sel ? 'text-black font-bold ring-[1.5px] ring-black ring-offset-1 cursor-pointer'    :
                    cur         ? 'text-neutral-700 hover:bg-neutral-100 hover:text-black cursor-pointer'        :
                                  'text-neutral-300 cursor-not-allowed',
                  ].join(' ')}
                >
                  {day}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-neutral-100">
          <button type="button"
            onClick={() => { onChange({ target: { value: '' } }); setOpen(false) }}
            className="text-[9px] font-medium text-neutral-400 hover:text-black transition-colors px-0.5">
            Clear
          </button>
          <button type="button" onClick={() => !todayDisabled && pick(today)} disabled={todayDisabled}
            className={`text-[9px] font-bold rounded-full px-2.5 py-0.5 transition-all
              ${todayDisabled ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' : 'bg-[#111] text-white hover:bg-neutral-800'}`}>
            Today
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={toggle}
        className={`w-full px-3 py-2 rounded-xl text-[12px] flex items-center justify-between transition-all cursor-pointer outline-none border
          ${open ? 'bg-white border-black shadow-sm' : 'bg-[#F8F8F8] border-transparent hover:bg-[#F0F0F0]'}`}
      >
        <span className={`text-[12px] font-medium ${display ? 'text-black' : 'text-[#BBBBBB]'}`}>
          {display || 'Select date'}
        </span>
        <CalendarDays size={12} className={open ? 'text-black' : 'text-[#C8C8C8]'} />
      </button>

      {open && createPortal(dropdown, document.body)}

      {required && (
        <input type="text" required readOnly value={value || ''} tabIndex={-1} className="sr-only" aria-hidden />
      )}
    </div>
  )
}
