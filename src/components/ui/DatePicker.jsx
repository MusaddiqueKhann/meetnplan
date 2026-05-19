import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DAYS   = ['S','M','T','W','T','F','S']
const DROPDOWN_H = 265

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DatePicker({ value, onChange, required, minDate, maxDate, offDays = [5, 6], dropUp = false }) {
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
    const onScroll = () => {
      if (triggerRef.current) setPos(calcPos(triggerRef.current.getBoundingClientRect()))
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll) }
  }, [open])

  function calcPos(rect) {
    const minW   = Math.max(rect.width, 260)
    const openUp = dropUp || (window.innerHeight - rect.bottom < DROPDOWN_H && rect.top >= DROPDOWN_H)
    return openUp
      ? { bottom: window.innerHeight - rect.top + 6, left: rect.left, width: minW }
      : { top: rect.bottom + 6, left: rect.left, width: minW }
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
      className="bg-white rounded-2xl border border-[#EBEBEB] shadow-[0_8px_40px_-4px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06)]"
    >
      {/* Month header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <button type="button" onClick={() => setView(new Date(year, month - 1, 1))}
          className="w-5 h-5 flex items-center justify-center rounded-md text-[#888] hover:text-black hover:bg-[#F5F5F5] transition-all">
          <ChevronLeft size={11} strokeWidth={2.5} />
        </button>
        <p className="text-[11px] font-bold text-black">{MONTHS[month]} {year}</p>
        <button type="button" onClick={() => setView(new Date(year, month + 1, 1))}
          className="w-5 h-5 flex items-center justify-center rounded-md text-[#888] hover:text-black hover:bg-[#F5F5F5] transition-all">
          <ChevronRight size={11} strokeWidth={2.5} />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 px-2">
        {DAYS.map((d, i) => (
          <div key={i} className="h-5 flex items-center justify-center text-[8px] font-bold text-[#CCCCCC] uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 px-2 pb-2">
        {cells.map(({ day, cur, date }, i) => {
          const sel = isSel(date)
          const tod = isTod(date)
          const dis = isDisabled(date)
          return (
            <div key={i} className="flex items-center justify-center">
              <button type="button" onClick={() => pick(date)} disabled={dis}
                className={[
                  'w-6 h-6 rounded-full text-[10px] transition-all flex items-center justify-center',
                  dis         ? 'text-[#E0E0E0] cursor-not-allowed'                                        :
                  sel         ? 'bg-black text-white font-bold cursor-pointer'                              :
                  tod && !sel ? 'bg-[#F0F0F0] text-black font-bold ring-[1.5px] ring-black ring-offset-1 cursor-pointer' :
                  cur         ? 'text-[#1A1A1A] font-medium hover:bg-[#F5F5F5] cursor-pointer'             :
                                'text-[#D4D4D4] cursor-not-allowed',
                ].join(' ')}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[#F2F2F2]">
        <button type="button"
          onClick={() => { onChange({ target: { value: '' } }); setOpen(false) }}
          className="text-[10px] font-semibold text-[#BBBBBB] hover:text-black transition-colors">
          Clear
        </button>
        <button type="button" onClick={() => !todayDisabled && pick(today)} disabled={todayDisabled}
          className={`text-[10px] font-semibold rounded px-2 py-1 transition-colors
            ${todayDisabled ? 'bg-[#F0F0F0] text-[#CCC] cursor-not-allowed' : 'text-white bg-black hover:bg-neutral-800'}`}>
          Today
        </button>
      </div>
    </div>
  )

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={toggle}
        className={`w-full px-4 py-3 rounded-2xl text-sm flex items-center justify-between transition-all cursor-pointer outline-none border
          ${open ? 'bg-white border-black' : 'bg-[#F9F9F9] border-[#E5E5E5] hover:border-[#C8C8C8]'}`}
      >
        <span className={display ? 'text-black font-medium' : 'text-[#AAAAAA]'}>
          {display || 'Select date'}
        </span>
        <CalendarDays size={14} className={open ? 'text-black' : 'text-[#BBBBBB]'} />
      </button>

      {open && createPortal(dropdown, document.body)}

      {required && (
        <input type="text" required readOnly value={value || ''} tabIndex={-1} className="sr-only" aria-hidden />
      )}
    </div>
  )
}
