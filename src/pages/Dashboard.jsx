import { Radio, Clock, BarChart2, CalendarCheck2, Trash2 } from 'lucide-react'
import Card from '../components/ui/Card'

const ALL_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n) { return String(n).padStart(2, '0') }
function toTimeStr(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}` }

function getWorkWeekDates(workDays) {
  const now = new Date()
  const sun = new Date(now)
  sun.setDate(now.getDate() - now.getDay())
  sun.setHours(0, 0, 0, 0)
  return workDays.map(dow => {
    const d = new Date(sun)
    d.setDate(sun.getDate() + dow)
    return {
      dow,
      label:   ALL_DAY_LABELS[dow],
      dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    }
  })
}

export default function Dashboard({ onOpenModal, bookings = [], deleteBooking, rooms = [], onNavigate, user, settings = {} }) {
  const canDelete = (b) => user?.role === 'admin' || b.ownerEmail === user?.email
  const now          = new Date()
  const todayStr   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(now.getDate() + 1)
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`

  const todayBookings = bookings.filter(b => b.date === todayStr)
  const liveItems     = todayBookings.filter(b => nowMinutes >= b.startMinutes && nowMinutes < b.endMinutes)
  const upcomingItems = todayBookings.filter(b => b.startMinutes > nowMinutes)
  const pastItems     = todayBookings.filter(b => b.endMinutes <= nowMinutes)

  const tomorrowBookings = bookings.filter(b => b.date === tomorrowStr)
  const tomorrowTimelineItems = [...tomorrowBookings]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map(b => ({ ...b, time: toTimeStr(b.startMinutes), isLive: false, isPast: false }))

  const showTomorrow = upcomingItems.length === 0 && liveItems.length === 0 && tomorrowTimelineItems.length > 0

  const avgDuration = bookings.length > 0
    ? Math.round(bookings.reduce((s, b) => s + (b.endMinutes - b.startMinutes), 0) / bookings.length)
    : 0

  const activeRoomCount = new Set(todayBookings.map(b => b.room)).size
  const totalRoomCount  = rooms.length || 0

  const offDays    = settings.offDays ?? [5, 6]
  const workDays   = [0, 1, 2, 3, 4, 5, 6].filter(d => !offDays.includes(d))
  const weekDates  = getWorkWeekDates(workDays)
  const barData    = weekDates.map(({ dateStr }) => bookings.filter(b => b.date === dateStr).length)
  const maxBar     = Math.max(...barData, 1)
  const todayDow   = now.getDay()

  const timelineItems = [...todayBookings]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map(b => ({
      ...b,
      time:   toTimeStr(b.startMinutes),
      isLive: nowMinutes >= b.startMinutes && nowMinutes < b.endMinutes,
      isPast: b.endMinutes <= nowMinutes,
    }))

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-[#666] mt-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={onOpenModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-2xl hover:bg-neutral-800 transition-colors"
        >
          + Schedule Meeting
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

        {/* Today's Meetings */}
        <Card className="p-5">
          <div className="mb-4">
            <div className="w-9 h-9 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl flex items-center justify-center">
              <CalendarCheck2 size={16} className="text-[#666]" />
            </div>
          </div>
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-1">Today's Meetings</p>
          <p className="text-2xl font-extrabold text-black tracking-tight mb-2">{todayBookings.length}</p>
          <p className="text-[11px] font-medium text-[#666]">
            {upcomingItems.length} upcoming · {pastItems.length} done
          </p>
        </Card>

        {/* Active Now */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="w-9 h-9 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl flex items-center justify-center">
              <Radio size={16} className="text-[#666]" />
            </div>
            {liveItems.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-black" />
                </span>
                <span className="text-[10px] font-semibold text-[#666]">LIVE</span>
              </div>
            )}
          </div>
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-1">Active Now</p>
          <p className="text-2xl font-extrabold text-black tracking-tight mb-2">{liveItems.length}</p>
          <p className="text-[11px] font-medium text-[#666]">
            {liveItems.length === 0 ? 'No meetings in progress' : `${liveItems.length} in progress`}
          </p>
        </Card>

        {/* Avg Duration */}
        <Card className="p-5">
          <div className="mb-4">
            <div className="w-9 h-9 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl flex items-center justify-center">
              <Clock size={16} className="text-[#666]" />
            </div>
          </div>
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-1">Avg. Duration</p>
          <p className="text-2xl font-extrabold text-black tracking-tight mb-2">
            {avgDuration > 0 ? `${avgDuration} min` : '—'}
          </p>
          <p className="text-[11px] font-medium text-[#666]">
            {bookings.length > 0
              ? `across ${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`
              : 'No bookings yet'}
          </p>
        </Card>

        {/* Rooms Used Today */}
        <Card className="p-5">
          <div className="mb-4">
            <div className="w-9 h-9 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl flex items-center justify-center">
              <BarChart2 size={16} className="text-[#666]" />
            </div>
          </div>
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-1">Rooms Used Today</p>
          <p className="text-2xl font-extrabold text-black tracking-tight mb-2">{activeRoomCount}</p>
          {totalRoomCount > 0 && (
            <div className="h-1.5 bg-[#E5E5E5] rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all"
                style={{ width: `${(activeRoomCount / totalRoomCount) * 100}%` }}
              />
            </div>
          )}
          <p className="text-[11px] font-medium text-[#666]">of {totalRoomCount} total rooms</p>
        </Card>
      </div>

      {/* Chart + Daily Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">

        {/* Weekly bar chart */}
        <Card className="lg:col-span-2 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-black">Weekly Meeting Load</h3>
              <p className="text-xs text-[#999] mt-0.5">Bookings per day this week</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-black rounded-sm" />
                <span className="text-xs text-[#999]">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#E5E5E5] rounded-sm" />
                <span className="text-xs text-[#999]">Other</span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3 h-40">
            {weekDates.map(({ dow, label }, i) => {
              const val     = barData[i]
              const isToday = dow === todayDow
              const pct     = (val / maxBar) * 100
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-2">
                  <span className={`text-[10px] font-semibold ${isToday ? 'text-black' : 'text-[#999]'}`}>{val}</span>
                  <div className="w-full relative" style={{ height: '100px' }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t-lg transition-all ${isToday ? 'bg-black' : 'bg-[#E5E5E5]'}`}
                      style={{ height: pct > 0 ? `${pct}%` : '3px' }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${isToday ? 'font-bold text-black' : 'text-[#999]'}`}>{label}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Daily Pulse */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-black">Daily Pulse</h3>
            <span className="text-[10px] font-semibold text-[#999] uppercase tracking-wide">
              {showTomorrow ? 'Tomorrow' : 'Today'}
            </span>
          </div>

          {timelineItems.length === 0 && !showTomorrow ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CalendarCheck2 size={26} className="text-[#DDD]" />
              <p className="text-xs font-semibold text-[#AAA]">No meetings today</p>
              <button
                onClick={onOpenModal}
                className="mt-1 text-[11px] font-semibold text-black underline underline-offset-2"
              >
                Schedule one
              </button>
            </div>
          ) : (
            <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: '340px' }}>
              {(showTomorrow ? tomorrowTimelineItems : timelineItems).map((item, idx, arr) => {
                const isLast      = idx === arr.length - 1
                const endTime     = toTimeStr(item.endMinutes)
                const duration    = item.endMinutes - item.startMinutes
                const durationLbl = duration >= 60
                  ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? ` ${duration % 60}m` : ''}`
                  : `${duration}m`
                const person = item.coordinator || item.companyName || null

                return (
                  <div key={item.id} className="flex gap-2.5 group">

                    {/* Time */}
                    <div className="w-10 flex-shrink-0 text-right pt-2.5">
                      <span className={`text-[10px] font-bold leading-none
                        ${item.isLive ? 'text-black' : 'text-[#AAAAAA]'}`}>
                        {item.time}
                      </span>
                    </div>

                    {/* Dot + connector line */}
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 14 }}>
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-2 z-10
                        ${item.isLive
                          ? 'bg-black ring-2 ring-black ring-offset-2'
                          : item.isPast
                            ? 'bg-[#CCCCCC]'
                            : 'bg-white border-2 border-[#CCCCCC]'}`}
                      />
                      {!isLast && (
                        <div className="w-px bg-[#E8E8E8] flex-1 mt-1" style={{ minHeight: 24 }} />
                      )}
                    </div>

                    {/* Card */}
                    <div
                      onClick={() => onNavigate?.('today')}
                      className={`flex-1 mb-2.5 rounded-xl border transition-all cursor-pointer
                        ${item.isLive
                          ? 'bg-black border-black'
                          : item.isPast
                            ? 'bg-[#F7F7F7] border-[#EFEFEF] hover:border-[#D4D4D4]'
                            : 'bg-white border-[#E8E8E8] group-hover:border-[#D4D4D4] group-hover:shadow-sm'}`}
                    >
                      <div className="px-3 py-2.5">
                        {/* Live badge */}
                        {item.isLive && (
                          <div className="flex items-center gap-1 mb-1.5">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-green-400">Live Now</span>
                          </div>
                        )}

                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-bold leading-snug flex-1 min-w-0
                            ${item.isLive ? 'text-white' : item.isPast ? 'text-[#888]' : 'text-black'}`}>
                            {item.title}
                          </p>
                          {/* Delete button — own bookings only */}
                          {canDelete(item) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteBooking?.(item.id) }}
                              className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors
                                ${item.isLive
                                  ? 'text-white/30 hover:bg-white/20 hover:text-white'
                                  : 'text-[#CCCCCC] hover:bg-red-50 hover:text-red-500'}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className={`flex items-center flex-wrap gap-x-2 gap-y-0 mt-1 text-[10px] font-medium
                          ${item.isLive ? 'text-white/55' : item.isPast ? 'text-[#BBB]' : 'text-[#999]'}`}>
                          <span className={`font-semibold ${item.isLive ? 'text-white/80' : item.isPast ? 'text-[#999]' : 'text-[#555]'}`}>
                            {item.room}
                          </span>
                          {person && <><span>·</span><span>{person}</span></>}
                          <span>·</span>
                          <span>{durationLbl}</span>
                          <span>·</span>
                          <span className={item.isLive ? 'text-white/70' : ''}>
                            {item.time} – {endTime}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
