import { useEffect, useState } from 'react'
import { MapPin, User, CalendarClock, Trash2, Clock, ChevronDown, CheckCircle2, Building2 } from 'lucide-react'

function pad(n) { return String(n).padStart(2, '0') }

function toAmPm(h, m) {
  const period = h >= 12 ? 'PM' : 'AM'
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(m)} ${period}`
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMeetingStatus(meeting, nowMinutes) {
  const start = meeting.startH * 60 + meeting.startM
  const end   = meeting.endH   * 60 + meeting.endM
  if (nowMinutes >= start && nowMinutes < end) return 'live'
  if (nowMinutes >= end) return 'past'
  return 'upcoming'
}

export default function TodaysMeetings({ onOpenModal, bookings = [], deleteBooking, rooms = [], user }) {
  const canDelete = (b) => user?.role === 'admin' || b.ownerEmail === user?.email
  const [now,          setNow]          = useState(new Date())
  const [selectedRoom, setSelectedRoom] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(rooms[0].name)
    }
  }, [rooms])

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const todayStr   = dateStr(now)

  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = dateStr(tomorrowDate)

  const mapBooking = b => ({
    id:          b.id,
    title:       b.title,
    room:        b.room,
    ownerEmail:  b.ownerEmail ?? '',
    organizer:   b.coordinator || b.companyName || '—',
    coordinator: b.coordinator || '—',
    company:     b.companyName || '—',
    startH:      Math.floor(b.startMinutes / 60),
    startM:      b.startMinutes % 60,
    endH:        Math.floor(b.endMinutes / 60),
    endM:        b.endMinutes % 60,
  })

  const todayBookings = bookings.filter(b => b.date === todayStr).map(mapBooking)

  const meetings = todayBookings
    .filter(b => b.room === selectedRoom)
    .sort((a, b) => (a.startH * 60 + a.startM) - (b.startH * 60 + b.startM))
    .map(m => ({ ...m, status: getMeetingStatus(m, nowMinutes) }))

  const liveCount     = meetings.filter(m => m.status === 'live').length
  const upcomingCount = meetings.filter(m => m.status === 'upcoming').length
  const pastCount     = meetings.filter(m => m.status === 'past').length

  const tomorrowMeetings = bookings
    .filter(b => b.date === tomorrowStr && b.room === selectedRoom)
    .map(mapBooking)
    .sort((a, b) => (a.startH * 60 + a.startM) - (b.startH * 60 + b.startM))

  const showTomorrow = upcomingCount === 0 && liveCount === 0 && tomorrowMeetings.length > 0

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const firstNonPastIdx = meetings.findIndex(m => m.status !== 'past')

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Page header */}
      <div className="flex flex-col gap-2.5 mb-4 sm:mb-5">

        {/* Row 1: Title + Schedule button */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-black tracking-tight leading-tight">Today's Meetings</h1>
            <p className="text-xs sm:text-sm text-[#999] mt-0.5 flex items-center flex-wrap gap-x-1.5 gap-y-0 leading-snug">
              <CalendarClock size={11} className="flex-shrink-0" />
              <span className="truncate">{dateLabel}</span>
              <span className="text-[#D4D4D4] flex-shrink-0">·</span>
              <Clock size={11} className="flex-shrink-0" />
              <span className="font-semibold text-[#777] flex-shrink-0">{toAmPm(now.getHours(), now.getMinutes())}</span>
            </p>
          </div>
          <button
            onClick={onOpenModal}
            className="flex-shrink-0 px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors duration-150"
          >
            + Schedule
          </button>
        </div>

        {/* Row 2: Stats badges + Room selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-3 py-1.5 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-xs font-medium text-[#666]">
              <span className="text-black font-bold">{meetings.length}</span> Total
            </span>
            {liveCount > 0 && (
              <span className="px-3 py-1.5 bg-black rounded-xl text-xs font-semibold text-white flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                {liveCount} Live
              </span>
            )}
            <span className="px-3 py-1.5 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-xs font-medium text-[#666]">
              <span className="text-black font-bold">{upcomingCount}</span> Upcoming
            </span>
            <span className="px-3 py-1.5 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-xs font-medium text-[#666]">
              <span className="text-black font-bold">{pastCount}</span> Past
            </span>
          </div>

          <div className="relative sm:ml-auto">
            <select
              value={selectedRoom}
              onChange={e => setSelectedRoom(e.target.value)}
              className="appearance-none w-full sm:w-auto pl-3 pr-8 py-2 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-black outline-none focus:border-black focus:bg-white transition-colors cursor-pointer"
            >
              <option value="" disabled>Select room</option>
              {rooms.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none" />
          </div>
        </div>

      </div>

      {/* Main card */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden flex flex-col">

        {/* Room name header */}
        {selectedRoom && (
          <div className="flex-shrink-0 flex items-center gap-2.5 px-5 py-3 border-b border-[#EBEBEB]">
            <span className="w-2 h-2 rounded-full bg-black flex-shrink-0" />
            <span className="text-sm font-bold text-black">{selectedRoom}</span>
            {rooms.find(r => r.name === selectedRoom)?.capacity && (
              <span className="text-xs text-[#AAAAAA] font-medium">
                · {rooms.find(r => r.name === selectedRoom).capacity} seats
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">

          {rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20">
              <CalendarClock size={28} className="text-[#DDD]" />
              <p className="text-sm font-semibold text-[#AAA]">No rooms added yet</p>
              <p className="text-xs text-[#CCC]">Go to Meeting Rooms to add your first room</p>
            </div>

          ) : !selectedRoom ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20">
              <CalendarClock size={28} className="text-[#DDD]" />
              <p className="text-sm font-semibold text-[#AAA]">Select a room to view its schedule</p>
            </div>

          ) : (
            <div className="flex flex-col p-4 gap-3">

              {meetings.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16">
                  <CalendarClock size={28} className="text-[#DDD]" />
                  <p className="text-sm font-semibold text-[#AAA]">No meetings scheduled today</p>
                  {showTomorrow
                    ? <p className="text-xs text-[#CCC]">See tomorrow&apos;s schedule below</p>
                    : <p className="text-xs text-[#CCC]">Use &ldquo;+ Schedule&rdquo; to book one</p>
                  }
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {meetings.map((meeting, idx) => {
                    const isLive      = meeting.status === 'live'
                    const isPast      = meeting.status === 'past'
                    const isUpcoming  = meeting.status === 'upcoming'
                    const startMin    = meeting.startH * 60 + meeting.startM
                    const endMin      = meeting.endH   * 60 + meeting.endM
                    const durationMin = endMin - startMin
                    const durationLabel = durationMin >= 60
                      ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ''}`
                      : `${durationMin}m`
                    const progressPct = isLive ? Math.min(100, Math.round(((nowMinutes - startMin) / durationMin) * 100)) : 0
                    const minsLeft    = isLive ? endMin - nowMinutes : 0

                    const showNowDivider = firstNonPastIdx === idx && firstNonPastIdx > 0

                    return (
                      <div key={meeting.id}>
                        {showNowDivider && (
                          <div className="flex items-center gap-3 my-1">
                            <div className="flex-1 h-px bg-[#E5E5E5]" />
                            <span className="text-[10px] font-semibold text-[#AAA] whitespace-nowrap">
                              {toAmPm(now.getHours(), now.getMinutes())} — Now
                            </span>
                            <div className="flex-1 h-px bg-[#E5E5E5]" />
                          </div>
                        )}

                        {isLive ? (
                          <div className="flex items-stretch gap-3 group/card">
                            {/* Time column */}
                            <div className="w-14 flex-shrink-0 flex flex-col items-end justify-center py-3">
                              <p className="text-xs font-bold text-black">{toAmPm(meeting.startH, meeting.startM)}</p>
                              <p className="text-[10px] font-medium text-[#AAA]">{toAmPm(meeting.endH, meeting.endM)}</p>
                            </div>
                            {/* Live card body */}
                            <div className="flex-1 min-w-0 rounded-xl overflow-hidden bg-gradient-to-br from-[#0D1A0D] to-[#090909] ring-1 ring-green-500/25 shadow-[0_4px_24px_rgba(74,222,128,0.08)]">
                              <div className="h-[1.5px] bg-gradient-to-r from-transparent via-green-400 to-transparent" />
                              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/10 border border-green-400/20">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                                  </span>
                                  <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-green-400">Live Now</span>
                                </span>
                                {canDelete(meeting) && (
                                  <button
                                    onClick={e => { e.stopPropagation(); deleteBooking?.(meeting.id) }}
                                    className="p-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                              <div className="px-4 pb-2">
                                <p className="text-base font-bold text-white tracking-tight leading-snug">{meeting.title}</p>
                              </div>
                              <div className="px-4 pb-3 flex flex-wrap items-center gap-y-1 gap-x-2.5">
                                <span className="flex items-center gap-1 text-[11px] text-green-400/70 font-medium">
                                  <MapPin size={10} className="flex-shrink-0" />
                                  {meeting.room}
                                </span>
                                <span className="text-green-400/20 select-none">·</span>
                                <span className="flex items-center gap-1 text-[11px] text-green-400/70 font-medium">
                                  <User size={10} className="flex-shrink-0" />
                                  {meeting.organizer}
                                </span>
                                {meeting.company !== '—' && (
                                  <>
                                    <span className="text-green-400/20 select-none">·</span>
                                    <span className="flex items-center gap-1 text-[11px] text-green-400/70 font-medium">
                                      <Building2 size={10} className="flex-shrink-0" />
                                      {meeting.company}
                                    </span>
                                  </>
                                )}
                                <span className="text-green-400/20 select-none">·</span>
                                <span className="flex items-center gap-1 text-[11px] text-green-400/70 font-medium">
                                  <Clock size={10} className="flex-shrink-0" />
                                  {toAmPm(meeting.startH, meeting.startM)} – {toAmPm(meeting.endH, meeting.endM)}
                                </span>
                              </div>
                              <div className="px-4 pb-2 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                                  <span className="text-[10px] font-semibold text-white/25 tracking-wide">In progress</span>
                                </div>
                                <span className="text-[11px] font-semibold text-white/35 tabular-nums">
                                  {minsLeft >= 60
                                    ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m left`
                                    : `${minsLeft}m left`}
                                </span>
                              </div>
                              <div className="mx-4 mb-3.5 h-1 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] transition-all duration-1000"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-stretch gap-3 group/card">
                            {/* Time column */}
                            <div className="w-14 flex-shrink-0 flex flex-col items-end justify-center py-3">
                              <p className={`text-xs font-bold ${isPast ? 'text-[#BBB]' : 'text-black'}`}>
                                {toAmPm(meeting.startH, meeting.startM)}
                              </p>
                              <p className={`text-[10px] font-medium ${isPast ? 'text-[#CCC]' : 'text-[#AAA]'}`}>
                                {toAmPm(meeting.endH, meeting.endM)}
                              </p>
                            </div>

                            {/* Card body */}
                            <div className={`flex-1 min-w-0 rounded-xl overflow-hidden transition-all duration-150
                              ${isPast
                                ? 'bg-[#F7F7F7] border border-[#E8E8E8] shadow-[inset_3px_0_0_#E0E0E0]'
                                : 'bg-white border border-[#E5E5E5] hover:border-neutral-300 hover:shadow-sm shadow-[inset_3px_0_0_#DCDCF0]'
                              }`}
                            >
                              <div className="px-4 py-3">
                                <div className="flex items-center gap-2 mb-1">
                                  {isPast && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F0F0F0] flex-shrink-0">
                                      <CheckCircle2 size={9} className="text-[#AAA]" />
                                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#AAA]">Ended</span>
                                    </span>
                                  )}
                                  {isUpcoming && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 flex-shrink-0">
                                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-400">Up Next</span>
                                    </span>
                                  )}
                                  <p className={`text-sm font-bold leading-snug truncate flex-1 ${isPast ? 'text-[#888]' : 'text-black'}`}>
                                    {meeting.title}
                                  </p>
                                  {canDelete(meeting) && (
                                    <button
                                      onClick={e => { e.stopPropagation(); deleteBooking?.(meeting.id) }}
                                      className="p-1 rounded-lg flex-shrink-0 text-[#CCC] hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                                <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 ${isPast ? 'text-[#BBB]' : 'text-[#888]'}`}>
                                  <span className="flex items-center gap-1 text-xs font-medium">
                                    <MapPin size={11} />
                                    <span className={isPast ? '' : 'text-[#555] font-semibold'}>{meeting.room}</span>
                                  </span>
                                  <span className="flex items-center gap-1 text-xs font-medium">
                                    <User size={11} />
                                    <span className={isPast ? '' : 'text-[#555] font-semibold'}>{meeting.organizer}</span>
                                  </span>
                                  <span className="flex items-center gap-1 text-xs font-medium">
                                    <Clock size={11} />
                                    {durationLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Tomorrow section */}
              {showTomorrow && (
                <div className="mt-2 rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F0F0F0] bg-[#FAFAFA]">
                    <CalendarClock size={14} className="text-[#888]" />
                    <span className="text-xs font-bold text-black">Tomorrow</span>
                    <span className="ml-auto px-2 py-0.5 bg-[#EBEBEB] rounded-full text-[10px] font-semibold text-[#666]">
                      {tomorrowMeetings.length} {tomorrowMeetings.length === 1 ? 'meeting' : 'meetings'}
                    </span>
                  </div>
                  <div className="divide-y divide-[#F5F5F5]">
                    {tomorrowMeetings.map(m => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-14 flex-shrink-0 text-right">
                          <p className="text-[11px] font-bold text-[#777]">{toAmPm(m.startH, m.startM)}</p>
                          <p className="text-[9px] font-medium text-[#CCC]">–{toAmPm(m.endH, m.endM)}</p>
                        </div>
                        <div className="w-px h-8 bg-[#E5E5E5] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-black truncate">{m.title}</p>
                          <p className="text-[10px] text-[#999] mt-0.5 font-medium">{m.organizer !== '—' ? m.organizer : m.room}</p>
                        </div>
                        {canDelete(m) && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteBooking?.(m.id) }}
                            className="p-1 rounded-lg flex-shrink-0 text-[#CCC] hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
