import { Radio, Clock, BarChart2, CalendarCheck2, Trash2, Bell, Briefcase, AlertCircle, CheckCheck, TrendingUp, Users } from 'lucide-react'
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

function minsToAmPm(m) {
  const h   = Math.floor(m / 60)
  const min = m % 60
  const p   = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(min)} ${p}`
}

function timeAgo(ts) {
  if (!ts?.toMillis) return ''
  const diff = Date.now() - ts.toMillis()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_BADGE = {
  approved:                  { label: 'Approved',          cls: 'bg-green-100 text-green-700'      },
  pending_priority_approval: { label: 'Awaiting Approval', cls: 'bg-amber-100 text-amber-700'      },
  // legacy statuses
  priority_pending:          { label: 'Priority Pending',  cls: 'bg-amber-100 text-amber-700'      },
  waiting_for_action:        { label: 'Action Needed',     cls: 'bg-red-100 text-red-600'          },
  rescheduled:               { label: 'Rescheduled',       cls: 'bg-blue-100 text-blue-700'        },
  cancelled:                 { label: 'Cancelled',         cls: 'bg-neutral-100 text-neutral-500'  },
  rejected:                  { label: 'Rejected',          cls: 'bg-red-100 text-red-600'          },
  pending:                   { label: 'Pending',           cls: 'bg-neutral-100 text-neutral-500'  },
}

export default function Dashboard({
  onOpenModal, bookings = [], deleteBooking, rooms = [], onNavigate, user,
  settings = {}, notifications = [], meetingHistory = [],
  markNotificationRead, markAllNotificationsRead,
}) {
  const canDelete = (b) => user?.role === 'admin' || b.ownerEmail === user?.email

  const now        = new Date()
  const todayStr   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(now.getDate() + 1)
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`

  // VISIBILITY RULE: pending_priority_approval meetings MUST be excluded from
  // all calendar/dashboard queries (Zero-Visibility Rule, spec §2).
  const isActive = (b) =>
    !b.status ||
    b.status === 'approved' ||
    b.status === 'rescheduled' ||
    b.status === 'waiting_for_action' // legacy: kept for backwards-compatibility

  const todayBookings    = bookings.filter(b => b.date === todayStr && isActive(b))
  const liveItems        = todayBookings.filter(b => nowMinutes >= b.startMinutes && nowMinutes < b.endMinutes)
  const upcomingItems    = todayBookings.filter(b => b.startMinutes > nowMinutes)
  const pastItems        = todayBookings.filter(b => b.endMinutes <= nowMinutes)
  const tomorrowBookings = bookings.filter(b => b.date === tomorrowStr && isActive(b))

  const tomorrowTimelineItems = [...tomorrowBookings]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map(b => ({ ...b, time: toTimeStr(b.startMinutes), isLive: false, isPast: false }))

  const showTomorrow = upcomingItems.length === 0 && liveItems.length === 0 && tomorrowTimelineItems.length > 0

  const activeBookings = bookings.filter(isActive)
  const avgDuration    = activeBookings.length > 0
    ? Math.round(activeBookings.reduce((s, b) => s + (b.endMinutes - b.startMinutes), 0) / activeBookings.length)
    : 0
  const activeRoomCount = new Set(todayBookings.map(b => b.room)).size
  const totalRoomCount  = rooms.length || 0

  const offDays   = settings.offDays ?? [5, 6]
  const workDays  = [0, 1, 2, 3, 4, 5, 6].filter(d => !offDays.includes(d))
  const weekDates = getWorkWeekDates(workDays)
  const barData   = weekDates.map(({ dateStr }) => bookings.filter(b => b.date === dateStr && isActive(b)).length)
  const maxBar    = Math.max(...barData, 1)
  const todayDow  = now.getDay()

  const timelineItems = [...todayBookings]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map(b => ({
      ...b,
      time:   toTimeStr(b.startMinutes),
      isLive: nowMinutes >= b.startMinutes && nowMinutes < b.endMinutes,
      isPast: b.endMinutes <= nowMinutes,
    }))

  // Client meeting analytics
  const clientMeetings   = bookings.filter(b => b.meetingType === 'client')
  // Count both new and legacy pending statuses
  const priorityPending  = bookings.filter(b =>
    b.status === 'pending_priority_approval' || b.status === 'priority_pending'
  )
  const waitingForAction = bookings.filter(b => b.status === 'waiting_for_action')
  const rescheduledCount = bookings.filter(b => b.status === 'rescheduled').length

  // Company with most client meetings
  const companyMap = {}
  clientMeetings.forEach(b => {
    const co = b.clientName || b.companyName || 'Unknown'
    companyMap[co] = (companyMap[co] ?? 0) + 1
  })
  const topCompany = Object.entries(companyMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // Peak booking hour
  const hourMap = {}
  activeBookings.forEach(b => {
    const h = Math.floor(b.startMinutes / 60)
    hourMap[h] = (hourMap[h] ?? 0) + 1
  })
  const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]
  const peakLabel = peakHour ? minsToAmPm(parseInt(peakHour[0]) * 60) : '—'

  // Unread notifications for current user
  const unreadNotifs = notifications.filter(n => !n.read)
  const urgentNotifs = notifications.filter(n => n.type === 'priority_request' && !n.read)

  return (
    <div className="space-y-6">

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

      {/* Urgent notifications banner */}
      {urgentNotifs.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle size={15} className="text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-bold text-amber-900 leading-snug">
                  Action Required —{' '}
                  <span className="font-extrabold">
                    {urgentNotifs.length > 1
                      ? `${urgentNotifs.length} Priority Conflicts`
                      : 'Priority Request'}
                  </span>
                </p>
                {/* Buttons: desktop/tablet inline */}
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onNavigate?.('myMeetings')}
                    className="px-3 py-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-xl hover:bg-amber-600 transition-colors whitespace-nowrap"
                  >
                    View Actions
                  </button>
                  <button
                    onClick={() => urgentNotifs.forEach(n => markNotificationRead?.(n.id))}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 text-[11px] font-semibold rounded-xl hover:bg-amber-50 transition-colors whitespace-nowrap"
                  >
                    {urgentNotifs.length > 1 ? 'Dismiss All' : 'Dismiss'}
                  </button>
                </div>
              </div>

              {urgentNotifs.length > 1 ? (
                <p className="text-[12px] text-amber-700 mt-1 leading-relaxed">
                  {urgentNotifs.length} priority client meeting requests require your decision.
                  Go to My Meetings to approve or reject each request.
                </p>
              ) : (
                <>
                  <p className="text-[12px] text-amber-700 mt-1 leading-relaxed">{urgentNotifs[0].message}</p>
                  {urgentNotifs[0].room && (
                    <p className="text-[11px] text-amber-600 mt-1.5 font-medium">
                      {urgentNotifs[0].room} · {urgentNotifs[0].date} · {minsToAmPm(urgentNotifs[0].startMinutes ?? 0)}–{minsToAmPm(urgentNotifs[0].endMinutes ?? 0)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Buttons: mobile only, below content */}
          <div className="flex sm:hidden items-center gap-2 mt-3 ml-11">
            <button
              onClick={() => onNavigate?.('myMeetings')}
              className="flex-1 py-2 bg-amber-500 text-white text-[12px] font-bold rounded-xl hover:bg-amber-600 transition-colors text-center"
            >
              View Actions
            </button>
            <button
              onClick={() => urgentNotifs.forEach(n => markNotificationRead?.(n.id))}
              className="px-4 py-2 bg-white border border-amber-300 text-amber-700 text-[12px] font-semibold rounded-xl hover:bg-amber-50 transition-colors whitespace-nowrap"
            >
              {urgentNotifs.length > 1 ? 'Dismiss All' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* All notifications panel (if any unread, non-urgent) */}
      {unreadNotifs.length > 0 && urgentNotifs.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3.5 flex items-center gap-4">
          <Bell size={15} className="text-blue-500 flex-shrink-0" />
          <p className="text-[12px] font-semibold text-blue-800 flex-1">
            You have {unreadNotifs.length} unread notification{unreadNotifs.length !== 1 ? 's' : ''}.
          </p>
          <button
            onClick={markAllNotificationsRead}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        </div>
      )}

      {/* KPI Cards — original 4 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-5">
          <div className="mb-4">
            <div className="w-9 h-9 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl flex items-center justify-center">
              <CalendarCheck2 size={16} className="text-[#666]" />
            </div>
          </div>
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wide mb-1">Today's Meetings</p>
          <p className="text-2xl font-extrabold text-black tracking-tight mb-2">{todayBookings.length}</p>
          <p className="text-[11px] font-medium text-[#666]">{upcomingItems.length} upcoming · {pastItems.length} done</p>
        </Card>

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
            {activeBookings.length > 0 ? `across ${activeBookings.length} booking${activeBookings.length !== 1 ? 's' : ''}` : 'No bookings yet'}
          </p>
        </Card>

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
              <div className="h-full bg-black rounded-full transition-all" style={{ width: `${(activeRoomCount / totalRoomCount) * 100}%` }} />
            </div>
          )}
          <p className="text-[11px] font-medium text-[#666]">of {totalRoomCount} total rooms</p>
        </Card>
      </div>

      {/* Client Meeting Analytics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Client Meetings',    value: clientMeetings.length,   icon: Briefcase,    color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Priority Pending',   value: priorityPending.length,  icon: AlertCircle,  color: 'text-red-500',   bg: 'bg-red-50'   },
          { label: 'Action Needed',      value: waitingForAction.length, icon: AlertCircle,  color: 'text-orange-500',bg: 'bg-orange-50' },
          { label: 'Rescheduled',        value: rescheduledCount,        icon: TrendingUp,   color: 'text-blue-500',  bg: 'bg-blue-50'  },
          { label: 'Top Client',         value: topCompany,              icon: Users,        color: 'text-purple-600',bg: 'bg-purple-50' },
          { label: 'Peak Hour',          value: peakLabel,               icon: Clock,        color: 'text-green-600', bg: 'bg-green-50'  },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="p-4">
            <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon size={13} className={color} />
            </div>
            <p className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-lg font-extrabold tracking-tight truncate ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Chart + Daily Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">

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
              <button onClick={onOpenModal} className="mt-1 text-[11px] font-semibold text-black underline underline-offset-2">
                Schedule one
              </button>
            </div>
          ) : (
            <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: '340px' }}>
              {(showTomorrow ? tomorrowTimelineItems : timelineItems).map((item, idx, arr) => {
                const isLast   = idx === arr.length - 1
                const endTime  = toTimeStr(item.endMinutes)
                const duration = item.endMinutes - item.startMinutes
                const durationLbl = duration >= 60
                  ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? ` ${duration % 60}m` : ''}`
                  : `${duration}m`
                const person = item.coordinator || item.companyName || null
                const statusInfo = STATUS_BADGE[item.status]
                const isWaiting    = item.status === 'waiting_for_action'
                const isPriPending = item.status === 'pending_priority_approval' || item.status === 'priority_pending'
                const isConflicted = isWaiting || isPriPending
                const liveClean    = item.isLive && !isConflicted

                return (
                  <div key={item.id} className="flex gap-2.5 group">
                    <div className="w-10 flex-shrink-0 text-right pt-2.5">
                      <span className={`text-[10px] font-bold leading-none ${liveClean ? 'text-black' : 'text-[#AAAAAA]'}`}>
                        {item.time}
                      </span>
                    </div>
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 14 }}>
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-2 z-10
                        ${liveClean
                          ? 'bg-black ring-2 ring-black ring-offset-2'
                          : isWaiting    ? 'bg-red-400 ring-2 ring-red-300 ring-offset-2'
                          : isPriPending ? 'bg-amber-400 ring-2 ring-amber-300 ring-offset-2'
                          : item.isPast  ? 'bg-[#CCCCCC]'
                          : 'bg-white border-2 border-[#CCCCCC]'}`}
                      />
                      {!isLast && <div className="w-px bg-[#E8E8E8] flex-1 mt-1" style={{ minHeight: 24 }} />}
                    </div>
                    <div
                      onClick={() => onNavigate?.('today')}
                      className={`flex-1 mb-2.5 rounded-xl border transition-all cursor-pointer
                        ${liveClean
                          ? 'bg-black border-black'
                          : isWaiting
                            ? 'bg-red-50 border-red-200 hover:border-red-300'
                            : isPriPending
                              ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                              : item.isPast
                                ? 'bg-[#F7F7F7] border-[#EFEFEF] hover:border-[#D4D4D4]'
                                : 'bg-white border-[#E8E8E8] group-hover:border-[#D4D4D4] group-hover:shadow-sm'}`}
                    >
                      <div className="px-3 py-2.5">
                        {liveClean && (
                          <div className="flex items-center gap-1 mb-1.5">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-green-400">Live Now</span>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold leading-snug
                              ${liveClean ? 'text-white' : item.isPast && !isConflicted ? 'text-[#888]' : 'text-black'}`}>
                              {item.title}
                            </p>
                            {/* Status + type badges */}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {item.meetingType === 'client' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full uppercase tracking-wide">
                                  Client
                                </span>
                              )}
                              {statusInfo && item.status !== 'approved' && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${statusInfo.cls}`}>
                                  {statusInfo.label}
                                </span>
                              )}
                            </div>
                          </div>
                          {canDelete(item) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteBooking?.(item.id) }}
                              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-colors text-[#CCCCCC] hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className={`flex items-center flex-wrap gap-x-2 gap-y-0 mt-1 text-[10px] font-medium
                          ${liveClean ? 'text-white/55' : item.isPast && !isConflicted ? 'text-[#BBB]' : 'text-[#999]'}`}>
                          <span className={`font-semibold ${liveClean ? 'text-white/80' : item.isPast && !isConflicted ? 'text-[#999]' : 'text-[#555]'}`}>
                            {item.room}
                          </span>
                          {person && <><span>·</span><span>{person}</span></>}
                          <span>·</span><span>{durationLbl}</span>
                          <span>·</span>
                          <span>{item.time} – {endTime}</span>
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
