import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, MapPin, Clock, Radio, User, Trash2 } from 'lucide-react'

const HOUR_HEIGHT = 320
const TIME_COL_W  = 72

function toAmPm(h, m = 0) {
  const p   = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${p}`
}
function minsToAmPm(totalMins) {
  return toAmPm(Math.floor(totalMins / 60), totalMins % 60)
}
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i)
const ALL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']
const VIEWS    = ['Month', 'Week', 'Day']

function getWeekDates(offset = 0, workDays = [0,1,2,3,4]) {
  const now = new Date()
  const sun = new Date(now)
  sun.setDate(now.getDate() - now.getDay() + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun); d.setDate(sun.getDate() + i); return d
  }).filter(d => workDays.includes(d.getDay()))
}

function getMonthCells(year, month, workDays = [0,1,2,3,4]) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthDays = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    if (workDays.includes(date.getDay())) monthDays.push(date)
  }
  if (monthDays.length === 0) return []

  // leading: walk back from first month workday to fill the row start
  const firstColIdx = workDays.indexOf(monthDays[0].getDay())
  const leading = []
  const cur0 = new Date(monthDays[0])
  for (let i = 0; i < firstColIdx; i++) {
    cur0.setDate(cur0.getDate() - 1)
    while (!workDays.includes(cur0.getDay())) cur0.setDate(cur0.getDate() - 1)
    leading.unshift({ date: new Date(cur0), cur: false })
  }

  // trailing: walk forward from last month workday to fill the row end
  const lastColIdx = workDays.indexOf(monthDays[monthDays.length - 1].getDay())
  const trailing = []
  const curN = new Date(monthDays[monthDays.length - 1])
  for (let i = lastColIdx; i < workDays.length - 1; i++) {
    curN.setDate(curN.getDate() + 1)
    while (!workDays.includes(curN.getDay())) curN.setDate(curN.getDate() + 1)
    trailing.push({ date: new Date(curN), cur: false })
  }

  return [
    ...leading,
    ...monthDays.map(d => ({ date: d, cur: true })),
    ...trailing,
  ]
}

function EventDetailModal({ event, onClose, onDelete, canDelete }) {
  if (!event) return null
  const startLabel = event.startMinutes != null ? minsToAmPm(event.startMinutes) : toAmPm(event.start)
  const endLabel   = event.endMinutes   != null ? minsToAmPm(event.endMinutes)   : toAmPm((event.start + event.span) % 24)
  const durationMins = event.endMinutes != null && event.startMinutes != null
    ? event.endMinutes - event.startMinutes : event.span * 60
  const durationLabel = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ''}` : `${durationMins}m`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`px-6 pt-6 pb-5 ${event.live ? 'bg-black' : event.status === 'waiting_for_action' ? 'bg-amber-50' : event.status === 'priority_pending' ? 'bg-orange-50' : 'bg-[#F9F9F9]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              {event.live && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Live Now</span>
                </div>
              )}
              {event.status === 'waiting_for_action' && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 mb-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-700">Action Needed</span>
                </div>
              )}
              {event.status === 'priority_pending' && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 border border-orange-200 mb-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-orange-600">Pending Approval</span>
                </div>
              )}
              <h2 className={`text-lg font-extrabold leading-snug ${event.live ? 'text-white' : 'text-black'}`}>{event.title}</h2>
            </div>
            <button onClick={onClose}
              className={`w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-colors
                ${event.live ? 'bg-white/10 hover:bg-white/20' : 'bg-[#EBEBEB] hover:bg-[#E0E0E0]'}`}>
              <X size={13} className={event.live ? 'text-white' : 'text-[#555]'} />
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          {[
            { icon: MapPin, label: 'Room',        value: event.room },
            { icon: Clock,  label: 'Time',        value: `${startLabel} – ${endLabel}` },
            { icon: Radio,  label: 'Duration',    value: durationLabel },
            ...(event.coordinator ? [{ icon: User, label: 'Coordinator', value: event.coordinator }] : []),
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#F5F5F5] rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-[#666]" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#999] uppercase tracking-wide">{label}</p>
                <p className="text-sm font-bold text-black">{value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-[#F0F0F0] bg-[#FAFAFA] rounded-b-2xl flex items-center justify-between">
          {canDelete ? (
            <button onClick={() => { onDelete(event.id); onClose() }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-2xl hover:bg-red-100 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          ) : (
            <span className="text-[11px] text-[#BBBBBB] font-medium">Not your meeting</span>
          )}
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-black rounded-2xl hover:bg-neutral-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Calendar({ onOpenModal, rooms = [], bookings = [], deleteBooking, weekKey, checkedRooms: checkedRoomsProp, user, settings = {} }) {
  const workStartHour = settings.workStartHour ?? 8
  const workEndHour   = settings.workEndHour   ?? 20
  const offDays       = settings.offDays       ?? [5, 6]
  const workDays      = [0,1,2,3,4,5,6].filter(d => !offDays.includes(d))
  const WEEKDAYS      = workDays.map(d => ALL_DAYS[d])
  const HOURS         = ALL_HOURS.filter(h => h >= workStartHour && h < workEndHour)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const todayStr   = dateToStr(now)
  const today      = now

  const [view,          setView]          = useState('Week')
  const [weekOffset,    setWeekOffset]    = useState(0)
  const [monthNav,      setMonthNav]      = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [dayDate,       setDayDate]       = useState(today)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const checkedRooms = checkedRoomsProp ?? new Set(rooms.map(r => r.name))

  const weekScrollRef = useRef(null)
  const dayScrollRef  = useRef(null)

  // On small screens switch away from Week view (hidden there)
  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 640 && view === 'Week') setView('Day')
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [view])

  // Auto-scroll to work start hour
  useEffect(() => {
    const scrollTarget = Math.max(0, (workStartHour) * HOUR_HEIGHT)
    if (view === 'Week' && weekScrollRef.current) weekScrollRef.current.scrollTop = scrollTarget
    if (view === 'Day'  && dayScrollRef.current)  dayScrollRef.current.scrollTop  = scrollTarget
  }, [view])

  const isActive = (b) =>
    !b.status || b.status === 'approved' || b.status === 'rescheduled' ||
    b.status === 'waiting_for_action' || b.status === 'priority_pending'

  const bookingEvents = bookings
    .filter(isActive)
    .map(b => {
      const startH = Math.floor(b.startMinutes / 60)
      const endH   = Math.ceil(b.endMinutes / 60)
      const isLive = b.date === todayStr && nowMinutes >= b.startMinutes && nowMinutes < b.endMinutes
      return {
        id: b.id, date: b.date, ownerEmail: b.ownerEmail,
        start: startH, span: Math.max(1, endH - startH),
        startMinutes: b.startMinutes, endMinutes: b.endMinutes,
        title: b.title, room: b.room,
        coordinator: b.coordinator || b.companyName || '',
        live: isLive,
        status: b.status,
      }
    })
    .sort((a, b) => a.startMinutes - b.startMinutes)

  const visibleEvents = bookingEvents.filter(e => checkedRooms.has(e.room))

  const weekDates    = getWeekDates(weekOffset, workDays)
  const weekDateStrs = weekDates.map(d => dateToStr(d))
  const todayIdx     = weekDates.findIndex(d => d.toDateString() === today.toDateString())

  const prevNav = () => {
    if (view === 'Week')  setWeekOffset(o => o - 1)
    if (view === 'Month') setMonthNav(({ year, month }) => month === 0  ? { year: year-1, month: 11 } : { year, month: month-1 })
    if (view === 'Day')   setDayDate(d => { const n = new Date(d); n.setDate(n.getDate()-1); return n })
  }
  const nextNav = () => {
    if (view === 'Week')  setWeekOffset(o => o + 1)
    if (view === 'Month') setMonthNav(({ year, month }) => month === 11 ? { year: year+1, month: 0  } : { year, month: month+1 })
    if (view === 'Day')   setDayDate(d => { const n = new Date(d); n.setDate(n.getDate()+1); return n })
  }
  const goToday = () => { setWeekOffset(0); setMonthNav({ year: today.getFullYear(), month: today.getMonth() }); setDayDate(today) }

  const headerLabel =
    view === 'Month' ? `${MONTHS[monthNav.month]} ${monthNav.year}` :
    view === 'Day'   ? dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) :
                       weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const dayDateStr   = dateToStr(dayDate)

  const weekGridCols  = `${TIME_COL_W}px repeat(${workDays.length}, 1fr)`
  const monthGridCols = `repeat(${workDays.length}, 1fr)`

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-black tracking-tight truncate">{headerLabel}</h1>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={prevNav}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E5E5E5] hover:bg-white transition-colors bg-white">
                <ChevronLeft size={14} className="text-[#666]" />
              </button>
              <button onClick={goToday}
                className="px-3.5 py-1.5 text-xs font-semibold text-black border border-[#E5E5E5] rounded-xl hover:bg-white transition-colors bg-white">
                Today
              </button>
              <button onClick={nextNav}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E5E5E5] hover:bg-white transition-colors bg-white">
                <ChevronRight size={14} className="text-[#666]" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-white border border-[#E5E5E5] rounded-xl p-1 gap-0.5">
              {VIEWS.map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors
                    ${v === 'Week' ? 'hidden sm:block' : ''}
                    ${view === v ? 'bg-black text-white' : 'text-[#666] hover:text-black'}`}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={onOpenModal}
              className="px-4 py-2 text-sm font-semibold bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors">
              + New
            </button>
          </div>
        </div>

        {/* ── WEEK VIEW ── */}
        {view === 'Week' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden flex flex-col">

            {/* Day header row */}
            <div className="flex-shrink-0 border-b border-[#EBEBEB] overflow-x-auto scrollbar-hide">
              <div className="grid min-w-[520px]" style={{ gridTemplateColumns: weekGridCols }}>
                <div className="border-r border-[#EBEBEB]" style={{ width: TIME_COL_W }} />
                {weekDates.map((date, i) => {
                  const isToday = i === todayIdx
                  return (
                    <div key={i}
                      onClick={() => { setDayDate(date); setView('Day') }}
                      className={`py-3.5 text-center border-r border-[#EBEBEB] last:border-r-0 cursor-pointer transition-colors
                        ${isToday ? 'bg-black' : 'hover:bg-[#F9F9F9]'}`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1
                        ${isToday ? 'text-white/50' : 'text-[#AAAAAA]'}`}>
                        {WEEKDAYS[i]}
                      </p>
                      <p className={`text-xl font-extrabold leading-none
                        ${isToday ? 'text-white' : 'text-black'}`}>
                        {date.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Scrollable time grid */}
            <div ref={weekScrollRef} className="flex-1 overflow-y-auto overflow-x-auto scrollbar-hide relative">
              <div className="relative min-w-[520px]">

                {/* Current time indicator */}
                {todayIdx >= 0 && now.getHours() >= workStartHour && now.getHours() < workEndHour && (
                  <div
                    className="absolute z-20 pointer-events-none flex items-center"
                    style={{
                      top: (nowMinutes / 60 - workStartHour) * HOUR_HEIGHT,
                      left: `calc(${TIME_COL_W}px + ${todayIdx} / ${workDays.length} * (100% - ${TIME_COL_W}px))`,
                      right: `calc(${workDays.length - 1 - todayIdx} / ${workDays.length} * (100% - ${TIME_COL_W}px))`,
                    }}
                  >
                    <div className="w-2 h-2 bg-black rounded-full flex-shrink-0 -ml-1" />
                    <div className="flex-1 h-px bg-black" />
                  </div>
                )}

                <div className="grid" style={{ gridTemplateColumns: weekGridCols }}>
                  {HOURS.map((hour) => (
                    <React.Fragment key={hour}>
                      {/* Time label column with quarter marks */}
                      <div
                        className="border-b border-r border-[#F3F3F3] px-3 relative flex-shrink-0"
                        style={{ height: HOUR_HEIGHT }}
                      >
                        <span className="absolute right-3 top-2 text-[11px] font-semibold text-[#AAA] leading-none">
                          {toAmPm(hour)}
                        </span>
                        <span className="absolute right-3 text-[9px] text-[#DDD] leading-none" style={{ top: '25%' }}>:15</span>
                        <span className="absolute right-3 text-[10px] text-[#CCC] leading-none" style={{ top: '50%' }}>:30</span>
                        <span className="absolute right-3 text-[9px] text-[#DDD] leading-none" style={{ top: '75%' }}>:45</span>
                      </div>

                      {/* Day cells */}
                      {weekDates.map((_, dIdx) => {
                        const ds    = weekDateStrs[dIdx]
                        const evs   = visibleEvents.filter(e => e.date === ds && e.start === hour)
                        const isTod = dIdx === todayIdx
                        return (
                          <div key={dIdx}
                            className={`border-b border-r border-[#F3F3F3] last:border-r-0 relative p-1
                              ${isTod ? 'bg-blue-50/30' : ''}`}
                            style={{ height: HOUR_HEIGHT }}
                          >
                            {/* Quarter-hour grid lines */}
                            <div className="absolute inset-x-0 border-t border-dashed border-[#F0F0F0] pointer-events-none" style={{ top: '25%' }} />
                            <div className="absolute inset-x-0 border-t border-[#EBEBEB] pointer-events-none"               style={{ top: '50%' }} />
                            <div className="absolute inset-x-0 border-t border-dashed border-[#F0F0F0] pointer-events-none" style={{ top: '75%' }} />
                            {evs.map((ev, ei) => {
                              const minuteOffset = Math.round((ev.startMinutes % 60) / 60 * HOUR_HEIGHT)
                              const heightPx = Math.max(18, Math.round((ev.endMinutes - ev.startMinutes) / 60 * HOUR_HEIGHT) - 4)
                              const md = heightPx >= 90
                              const lg = heightPx >= 160
                              const isWaiting    = ev.status === 'waiting_for_action'
                              const isPriPending = ev.status === 'priority_pending'
                              return (
                              <div key={ei}
                                onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                                className={`absolute inset-x-1 rounded-lg cursor-pointer transition-all overflow-hidden flex
                                  ${ev.live
                                    ? 'bg-black text-white shadow-lg'
                                    : isWaiting
                                    ? 'bg-amber-50 text-black border border-amber-300 hover:border-amber-500 hover:shadow-md'
                                    : isPriPending
                                    ? 'bg-orange-50 text-black border border-orange-300 hover:border-orange-500 hover:shadow-md'
                                    : 'bg-white text-black border border-[#E0E0E0] hover:border-black hover:shadow-md'}`}
                                style={{ top: minuteOffset + 2, height: heightPx, zIndex: 10 }}
                              >
                                {!ev.live && <div className={`w-[3px] flex-shrink-0 self-stretch rounded-l-md ${isWaiting ? 'bg-amber-400' : isPriPending ? 'bg-orange-400' : 'bg-black'}`} />}
                                <div className={`flex flex-col flex-1 min-w-0 justify-between
                                  ${heightPx < 40 ? 'px-1.5 py-0.5' : lg ? 'px-2 py-2' : 'px-1.5 py-1.5'}`}>
                                  <div className="min-w-0">
                                    {ev.live && heightPx >= 32 && (
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                                        </span>
                                        <span className="text-[7px] font-bold uppercase tracking-widest text-white/50">Live</span>
                                      </div>
                                    )}
                                    {(isWaiting || isPriPending) && heightPx >= 32 && (
                                      <div className={`text-[7px] font-bold uppercase tracking-widest mb-0.5 ${isWaiting ? 'text-amber-600' : 'text-orange-500'}`}>
                                        {isWaiting ? 'Action Needed' : 'Pending Approval'}
                                      </div>
                                    )}
                                    <p className={`font-extrabold leading-snug
                                      ${lg ? 'text-[11px] line-clamp-3' : md ? 'text-[10px] line-clamp-2' : 'text-[10px] truncate'}`}>
                                      {ev.title}
                                    </p>
                                    {heightPx >= 38 && (
                                      <div className={`flex items-center gap-0.5 mt-0.5 min-w-0 font-semibold
                                        ${md ? 'text-[9px]' : 'text-[8px]'} ${ev.live ? 'text-white/55' : isWaiting ? 'text-amber-700' : isPriPending ? 'text-orange-700' : 'text-[#777]'}`}>
                                        <MapPin size={7} className="flex-shrink-0" />
                                        <span className="truncate">{ev.room}</span>
                                      </div>
                                    )}
                                    {heightPx >= 56 && ev.coordinator && (
                                      <div className={`flex items-center gap-0.5 mt-0.5 min-w-0 font-medium
                                        ${md ? 'text-[9px]' : 'text-[8px]'} ${ev.live ? 'text-white/40' : 'text-[#AAA]'}`}>
                                        <User size={7} className="flex-shrink-0" />
                                        <span className="truncate">{ev.coordinator}</span>
                                      </div>
                                    )}
                                  </div>
                                  {md && (
                                    <div className={`flex items-center gap-0.5 min-w-0 font-semibold text-[8px]
                                      ${ev.live ? 'text-white/35' : 'text-[#BBB]'}`}>
                                      <Clock size={7} className="flex-shrink-0" />
                                      <span className="truncate">{minsToAmPm(ev.startMinutes)} – {minsToAmPm(ev.endMinutes)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )})}
                          </div>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MONTH VIEW ── */}
        {view === 'Month' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden flex flex-col">
            {/* Weekday header — single letter on mobile, abbreviated on desktop */}
            <div className="grid border-b border-[#EBEBEB] flex-shrink-0" style={{ gridTemplateColumns: monthGridCols }}>
              {WEEKDAYS.map(d => (
                <div key={d}
                  className="py-2.5 sm:py-3 text-center text-[10px] font-bold uppercase tracking-widest border-r border-[#EBEBEB] last:border-r-0 text-[#AAAAAA]">
                  <span className="sm:hidden">{d[0]}</span>
                  <span className="hidden sm:inline">{d}</span>
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="grid h-full" style={{ gridTemplateColumns: monthGridCols }}>
                {getMonthCells(monthNav.year, monthNav.month, workDays).map(({ date, cur }, i) => {
                  const isToday  = date.toDateString() === today.toDateString()
                  const cellStr  = dateToStr(date)
                  const allEvs   = visibleEvents.filter(e => e.date === cellStr)
                  const hasLive  = allEvs.some(e => e.live)
                  return (
                    <div key={i}
                      onClick={() => { setDayDate(date); setView('Day') }}
                      className={`border-b border-r border-[#F3F3F3] last:border-r-0 p-1.5 sm:p-2 min-h-[68px] sm:min-h-[90px] cursor-pointer transition-colors relative
                        ${!cur ? 'bg-[#FAFAFA] hover:bg-[#F5F5F5]' : 'hover:bg-[#FAFAFA]'}`}
                    >
                      {/* Day number */}
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full font-bold mb-1 sm:mb-1.5
                        text-[11px] sm:text-xs
                        ${isToday ? 'bg-black text-white shadow-sm' : cur ? 'text-black' : 'text-[#CCCCCC]'}`}>
                        {date.getDate()}
                      </div>

                      {/* Mobile: event dots + count */}
                      {allEvs.length > 0 && (
                        <div className="sm:hidden flex items-center gap-0.5 flex-wrap">
                          {allEvs.slice(0, 3).map((ev, ei) => (
                            <span key={ei}
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                                ${ev.live ? 'bg-black' : ev.status === 'waiting_for_action' ? 'bg-amber-400' : ev.status === 'priority_pending' ? 'bg-orange-400' : 'bg-[#AAAAAA]'}`}
                            />
                          ))}
                          {allEvs.length > 3 && (
                            <span className="text-[8px] font-bold text-[#AAAAAA] leading-none ml-0.5">
                              +{allEvs.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Mobile: event count badge when there are events */}
                      {allEvs.length > 0 && (
                        <div className={`sm:hidden absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center
                          text-[8px] font-bold
                          ${hasLive ? 'bg-black text-white' : 'bg-[#F0F0F0] text-[#666]'}`}>
                          {allEvs.length}
                        </div>
                      )}

                      {/* Desktop: event pills */}
                      <div className="hidden sm:block space-y-0.5">
                        {allEvs.slice(0, 3).map((ev, ei) => (
                          <div key={ei}
                            onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold truncate cursor-pointer transition-colors
                              ${ev.live
                                ? 'bg-black text-white'
                                : ev.status === 'waiting_for_action'
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : ev.status === 'priority_pending'
                                ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                : 'bg-[#F0F0F0] text-black hover:bg-[#E5E5E5]'}`}>
                            {ev.live && <span className="inline-block w-1 h-1 bg-green-400 rounded-full mr-0.5 mb-px" />}
                            {ev.title}
                          </div>
                        ))}
                        {allEvs.length > 3 && (
                          <div className="text-[9px] px-1.5 py-0.5 font-semibold text-[#999]">
                            +{allEvs.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── DAY VIEW ── */}
        {view === 'Day' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden flex flex-col">
            {/* Day header */}
            <div className="flex-shrink-0 border-b border-[#EBEBEB] px-5 py-4 flex items-center gap-4 bg-white">
              <div className={`w-11 h-11 flex items-center justify-center rounded-xl text-lg font-extrabold flex-shrink-0
                ${dayDate.toDateString() === today.toDateString() ? 'bg-black text-white' : 'bg-[#F5F5F5] text-black'}`}>
                {dayDate.getDate()}
              </div>
              <div>
                <p className="text-sm font-extrabold text-black">
                  {dayDate.toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
                <p className="text-xs text-[#AAAAAA] font-medium mt-0.5">
                  {dayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div ref={dayScrollRef} className="flex-1 overflow-y-auto scrollbar-hide relative">
              {/* Current time indicator (day view) */}
              {dayDate.toDateString() === today.toDateString() && now.getHours() >= workStartHour && now.getHours() < workEndHour && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                  style={{ top: (nowMinutes / 60 - workStartHour) * HOUR_HEIGHT }}
                >
                  <div style={{ width: TIME_COL_W }} className="flex justify-end pr-3 flex-shrink-0">
                    <span className="text-[10px] font-bold text-black -translate-y-2">
                      {toAmPm(today.getHours(), today.getMinutes())}
                    </span>
                  </div>
                  <div className="flex items-center flex-1">
                    <div className="w-2 h-2 bg-black rounded-full flex-shrink-0 -ml-1" />
                    <div className="flex-1 h-px bg-black" />
                  </div>
                </div>
              )}

              {HOURS.map((hour) => {
                const evs = visibleEvents.filter(e => e.date === dayDateStr && e.start === hour)
                return (
                  <div key={hour} className={`flex border-b border-[#F3F3F3] relative`} style={{ minHeight: HOUR_HEIGHT }}>
                    {/* Quarter-hour lines */}
                    <div className="absolute inset-x-0 border-t border-dashed border-[#F0F0F0] pointer-events-none" style={{ top: '25%', left: TIME_COL_W }} />
                    <div className="absolute inset-x-0 border-t border-[#EBEBEB] pointer-events-none"               style={{ top: '50%', left: TIME_COL_W }} />
                    <div className="absolute inset-x-0 border-t border-dashed border-[#F0F0F0] pointer-events-none" style={{ top: '75%', left: TIME_COL_W }} />
                    <div className="flex-shrink-0 border-r border-[#F3F3F3] px-3 relative text-right" style={{ width: TIME_COL_W }}>
                      <span className="absolute right-3 top-2 text-[11px] font-semibold text-[#AAA] leading-none">{toAmPm(hour)}</span>
                      <span className="absolute right-3 text-[9px] text-[#DDD] leading-none" style={{ top: '25%' }}>:15</span>
                      <span className="absolute right-3 text-[10px] text-[#CCC] leading-none" style={{ top: '50%' }}>:30</span>
                      <span className="absolute right-3 text-[9px] text-[#DDD] leading-none" style={{ top: '75%' }}>:45</span>
                    </div>
                    <div className="flex-1 relative">
                      {evs.map((ev, ei) => {
                        const minuteOffset = Math.round((ev.startMinutes % 60) / 60 * HOUR_HEIGHT)
                        const heightPx = Math.max(18, Math.round((ev.endMinutes - ev.startMinutes) / 60 * HOUR_HEIGHT) - 4)
                        const md = heightPx >= 90
                        const lg = heightPx >= 160
                        const xl = heightPx >= 280
                        const isWaiting    = ev.status === 'waiting_for_action'
                        const isPriPending = ev.status === 'priority_pending'
                        return (
                          <div key={ei}
                            onClick={() => setSelectedEvent(ev)}
                            className={`absolute left-1.5 right-1.5 rounded-xl cursor-pointer transition-all overflow-hidden flex
                              ${ev.live
                                ? 'bg-black text-white shadow-lg'
                                : isWaiting
                                ? 'bg-amber-50 text-black border border-amber-300 hover:border-amber-500 hover:shadow-md'
                                : isPriPending
                                ? 'bg-orange-50 text-black border border-orange-300 hover:border-orange-500 hover:shadow-md'
                                : 'bg-white text-black border border-[#E0E0E0] hover:border-black hover:shadow-md'}`}
                            style={{ top: minuteOffset + 2, height: heightPx, zIndex: 10 }}
                          >
                            {!ev.live && <div className={`w-1 flex-shrink-0 self-stretch rounded-l-xl ${isWaiting ? 'bg-amber-400' : isPriPending ? 'bg-orange-400' : 'bg-black'}`} />}
                            <div className={`flex flex-col flex-1 min-w-0 justify-between
                              ${heightPx < 44 ? 'px-2.5 py-1' : lg ? 'px-4 py-3' : 'px-3 py-2'}`}>
                              <div className="min-w-0">
                                {ev.live && (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="relative flex h-2 w-2 flex-shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                                    </span>
                                    <span className={`font-bold uppercase tracking-widest text-white/50 ${lg ? 'text-[10px]' : 'text-[8px]'}`}>Live Now</span>
                                  </div>
                                )}
                                {(isWaiting || isPriPending) && heightPx >= 36 && (
                                  <div className={`font-bold uppercase tracking-widest mb-1 ${lg ? 'text-[10px]' : 'text-[8px]'} ${isWaiting ? 'text-amber-600' : 'text-orange-500'}`}>
                                    {isWaiting ? 'Action Needed' : 'Pending Approval'}
                                  </div>
                                )}
                                <p className={`font-extrabold leading-snug
                                  ${lg ? 'text-[15px] line-clamp-3' : md ? 'text-sm line-clamp-2' : 'text-xs truncate'}`}>
                                  {ev.title}
                                </p>
                                {heightPx >= 44 && (
                                  <div className={`flex items-center gap-1 mt-1 min-w-0 font-semibold
                                    ${lg ? 'text-[11px]' : 'text-[10px]'} ${ev.live ? 'text-white/60' : isWaiting ? 'text-amber-700' : isPriPending ? 'text-orange-700' : 'text-[#666]'}`}>
                                    <Clock size={9} className="flex-shrink-0" />
                                    <span className="truncate">{minsToAmPm(ev.startMinutes)} – {minsToAmPm(ev.endMinutes)}</span>
                                  </div>
                                )}
                                {heightPx >= 64 && ev.coordinator && (
                                  <div className={`flex items-center gap-1 mt-0.5 min-w-0 font-medium
                                    ${lg ? 'text-[11px]' : 'text-[10px]'} ${ev.live ? 'text-white/45' : 'text-[#999]'}`}>
                                    <User size={9} className="flex-shrink-0" />
                                    <span className="truncate">{ev.coordinator}</span>
                                  </div>
                                )}
                                {lg && (
                                  <div className={`flex items-center gap-1 mt-0.5 min-w-0 font-medium text-[10px]
                                    ${ev.live ? 'text-white/35' : 'text-[#BBB]'}`}>
                                    <MapPin size={9} className="flex-shrink-0" />
                                    <span className="truncate">{ev.room}</span>
                                  </div>
                                )}
                              </div>
                              {xl && ev.live && (
                                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                                  <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Happening now</span>
                                </div>
                              )}
                              {xl && !ev.live && (
                                <div className={`flex items-center gap-1 min-w-0 font-medium text-[10px] text-[#BBB]`}>
                                  <MapPin size={9} className="flex-shrink-0" />
                                  <span className="truncate">{ev.room}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDelete={id => deleteBooking?.(id)}
        canDelete={selectedEvent ? (user?.role === 'admin' || selectedEvent.ownerEmail === user?.email) : false}
      />
    </div>
  )
}
