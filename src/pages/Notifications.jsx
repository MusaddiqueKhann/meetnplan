import { useState } from 'react'
import { Bell, CheckCheck, Trash2, ArrowLeft, ArrowRight, Zap, Check, X, RotateCcw, AlertTriangle } from 'lucide-react'

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

function fmtDateTime(ts) {
  if (!ts?.toMillis) return '—'
  const d = new Date(ts.toMillis())
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

const TYPE_CONFIG = {
  priority_request:    { label: 'Priority Request', accent: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-700',   icon: Zap,           border: 'border-l-amber-400'   },
  meeting_approved:    { label: 'Approved',          accent: 'bg-green-500',   light: 'bg-green-50',   text: 'text-green-700',   icon: Check,         border: 'border-l-green-400'   },
  priority_rejected:   { label: 'Rejected',          accent: 'bg-red-600',     light: 'bg-red-50',     text: 'text-red-700',     icon: X,             border: 'border-l-red-400'     },
  priority_withdrawn:  { label: 'Withdrawn',         accent: 'bg-neutral-500', light: 'bg-neutral-50', text: 'text-neutral-600', icon: RotateCcw,     border: 'border-l-neutral-300' },
  meeting_cancelled:   { label: 'Cancelled',         accent: 'bg-red-500',     light: 'bg-red-50',     text: 'text-red-600',     icon: X,             border: 'border-l-red-400'     },
  meeting_rescheduled: { label: 'Rescheduled',       accent: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700',    icon: RotateCcw,     border: 'border-l-blue-400'    },
  admin_override:      { label: 'Admin Action',      accent: 'bg-red-700',     light: 'bg-red-50',     text: 'text-red-800',     icon: AlertTriangle, border: 'border-l-red-600'     },
}

const FALLBACK_CONFIG = { label: 'Notification', accent: 'bg-neutral-400', light: 'bg-neutral-50', text: 'text-neutral-600', icon: Bell, border: 'border-l-neutral-300' }

export default function Notifications({
  notifications = [],
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  onNavigate,
}) {
  const [selected, setSelected] = useState(new Set())

  const unread = notifications.filter(n => !n.read).length

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const allSelected = notifications.length > 0 && selected.size === notifications.length
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(notifications.map(n => n.id)))

  const handleDeleteSelected = async () => {
    await Promise.all([...selected].map(id => deleteNotification?.(id)))
    setSelected(new Set())
  }

  const handleDeleteAll = async () => {
    await deleteAllNotifications?.()
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft size={16} className="text-neutral-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">Notifications</h1>
          <p className="text-sm text-neutral-400">
            {unread > 0 ? `${unread} unread notification${unread !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-3.5 h-3.5 accent-black rounded cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-neutral-400" />
              <span className="text-[13px] font-bold text-black">All Notifications</span>
              <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] font-bold rounded-full">
                {notifications.length}
              </span>
              {unread > 0 && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full">
                  {unread} unread
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {unread > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-neutral-600 hover:text-black border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
            {selected.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all"
              >
                <Trash2 size={12} /> Delete ({selected.size})
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-500 hover:text-red-700 border border-red-100 rounded-xl hover:bg-red-50 transition-all"
              >
                <Trash2 size={12} /> Delete All
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center">
              <Bell size={20} className="text-neutral-300" />
            </div>
            <p className="text-[13px] font-semibold text-neutral-400">No notifications yet</p>
            <p className="text-[12px] text-neutral-300">You're all caught up</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {notifications.map(n => {
              const cfg      = TYPE_CONFIG[n.type] ?? FALLBACK_CONFIG
              const TypeIcon = cfg.icon
              const isPriority = n.type === 'priority_request'

              return (
                <div
                  key={n.id}
                  onClick={() => { if (!n.read) markNotificationRead?.(n.id) }}
                  className={`group flex flex-col sm:flex-row sm:items-start gap-3 px-5 py-4 border-l-[3px] transition-all cursor-pointer
                    ${!n.read
                      ? `${cfg.border} bg-neutral-50/60 hover:bg-neutral-100/60`
                      : 'border-l-transparent hover:bg-neutral-50/50'
                    }`}
                >
                  {/* LEFT — checkbox + icon (fixed) */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div onClick={e => { e.stopPropagation(); toggleSelect(n.id) }}>
                      <input
                        type="checkbox"
                        checked={selected.has(n.id)}
                        onChange={() => toggleSelect(n.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-3.5 h-3.5 accent-black rounded cursor-pointer"
                      />
                    </div>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.light}`}>
                      <TypeIcon size={15} className={cfg.text} />
                    </div>
                  </div>

                  {/* RIGHT — 3 rows */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">

                    {/* Line 1 — badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${cfg.light} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      {n.read
                        ? <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-2.5 py-0.5 rounded-full">Read</span>
                        : <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">Unread</span>
                      }
                    </div>

                    {/* Line 2 — message + action buttons */}
                    <div className="flex items-start justify-between gap-6">
                      <p className="text-[13px] font-medium text-black leading-snug flex-1 min-w-0">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isPriority && (
                          <button
                            onClick={e => { e.stopPropagation(); onNavigate?.('myMeetings') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-xl transition-colors whitespace-nowrap shadow-sm"
                          >
                            View Action <ArrowRight size={11} />
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); deleteNotification?.(n.id) }}
                          title="Delete"
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-400 hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Line 3 — meta + date inline */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                      <span className="text-[11px] text-neutral-400">
                        {[n.room, n.date, timeAgo(n.createdAt), fmtDateTime(n.createdAt)].filter(Boolean).join(' · ')}
                      </span>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
