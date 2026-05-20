import { useState } from 'react'
import { Bell, CheckCheck, Trash2, ArrowLeft, ArrowRight } from 'lucide-react'

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

const TYPE_COLOR = {
  priority_request:    'bg-amber-500',
  meeting_approved:    'bg-green-500',
  priority_rejected:   'bg-red-600',
  priority_withdrawn:  'bg-neutral-500',
  meeting_cancelled:   'bg-red-500',
  meeting_rescheduled: 'bg-blue-500',
  admin_override:      'bg-red-700',
}
const TYPE_LABEL = {
  priority_request:    '⚡ Priority Request',
  meeting_approved:    '✓ Approved',
  priority_rejected:   '✕ Rejected',
  priority_withdrawn:  '↩ Withdrawn',
  meeting_cancelled:   '✕ Cancelled',
  meeting_rescheduled: '↗ Rescheduled',
  admin_override:      '⚠ Admin Action',
}

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

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(notifications.map(n => n.id)))

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

      {/* Table card */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-neutral-400" />
            <span className="text-[13px] font-bold text-black">All Notifications</span>
            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] font-bold rounded-full">
              {notifications.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {notifications.some(n => !n.read) && (
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                  <th className="w-10 pl-5 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5 accent-black rounded cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 whitespace-nowrap">
                    Date &amp; Time
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                    Status
                  </th>
                  <th className="pr-5 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {notifications.map(n => (
                  <tr
                    key={n.id}
                    onClick={() => { if (!n.read) markNotificationRead?.(n.id) }}
                    className={`group transition-colors cursor-pointer ${
                      !n.read ? 'bg-blue-50/30 hover:bg-blue-50/60' : 'hover:bg-neutral-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <td
                      className="pl-5 py-3.5"
                      onClick={e => { e.stopPropagation(); toggleSelect(n.id) }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(n.id)}
                        onChange={() => toggleSelect(n.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-3.5 h-3.5 accent-black rounded cursor-pointer"
                      />
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-[11px] text-neutral-600 font-medium">
                            {fmtDateTime(n.createdAt)}
                          </p>
                          <p className="text-[10px] text-neutral-400">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full text-white whitespace-nowrap ${TYPE_COLOR[n.type] ?? 'bg-neutral-400'}`}>
                        {TYPE_LABEL[n.type] ?? n.type}
                      </span>
                    </td>

                    {/* Message */}
                    <td className="px-4 py-3.5 max-w-sm">
                      <p className="text-[12px] font-medium text-black leading-snug line-clamp-2">
                        {n.message}
                      </p>
                      {(n.room || n.date) && (
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {[n.room, n.date].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {n.type === 'priority_request' && (
                        <button
                          onClick={e => { e.stopPropagation(); onNavigate?.('myMeetings') }}
                          className="mt-1.5 flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap"
                        >
                          View Action <ArrowRight size={10} />
                        </button>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {n.read ? (
                        <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                          Read
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          Unread
                        </span>
                      )}
                    </td>

                    {/* Row delete */}
                    <td className="pr-5 py-3.5">
                      <button
                        onClick={e => { e.stopPropagation(); deleteNotification?.(n.id) }}
                        title="Delete"
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-400 hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
