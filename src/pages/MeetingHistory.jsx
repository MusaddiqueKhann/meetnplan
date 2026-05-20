import { useState } from 'react'
import { History, Trash2, ArrowLeft } from 'lucide-react'

const HISTORY_ACTIONS = {
  created:                { label: 'Created',             cls: 'bg-green-100 text-green-700'     },
  priority_created:       { label: 'Priority Requested',  cls: 'bg-amber-100 text-amber-700'     },
  partial_approved:       { label: 'Partially Approved',  cls: 'bg-yellow-100 text-yellow-700'   },
  approved:               { label: 'Approved',            cls: 'bg-green-100 text-green-700'     },
  rejected:               { label: 'Rejected',            cls: 'bg-red-100 text-red-600'         },
  withdrawn:              { label: 'Withdrawn',           cls: 'bg-neutral-100 text-neutral-500' },
  deleted_with_reason:    { label: 'Deleted',             cls: 'bg-red-100 text-red-600'         },
  rescheduled:            { label: 'Rescheduled',         cls: 'bg-blue-100 text-blue-700'       },
  cancelled:              { label: 'Cancelled',           cls: 'bg-neutral-100 text-neutral-500' },
  admin_override_deleted: { label: 'Admin Removed',       cls: 'bg-red-100 text-red-700'         },
}

function pad(n) { return String(n).padStart(2, '0') }
function minsToAmPm(m) {
  const h   = Math.floor(m / 60)
  const min = m % 60
  const p   = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(min)} ${p}`
}
function fmtDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

export default function MeetingHistoryPage({
  meetingHistory = [],
  user,
  deleteHistoryEntry,
  onNavigate,
}) {
  const [selected, setSelected] = useState(new Set())

  // Admins see all entries; regular users see their own only
  const entries = user.role === 'admin'
    ? meetingHistory
    : meetingHistory.filter(h => h.performedByEmail === user.email)

  const allSelected = entries.length > 0 && selected.size === entries.length

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(entries.map(h => h.id)))

  const handleDeleteSelected = async () => {
    await Promise.all([...selected].map(id => deleteHistoryEntry?.(id)))
    setSelected(new Set())
  }

  const handleDeleteAll = async () => {
    await Promise.all(entries.map(h => deleteHistoryEntry?.(h.id)))
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
          <h1 className="text-xl font-bold text-black tracking-tight">Meeting History</h1>
          <p className="text-sm text-neutral-400">
            {user.role === 'admin' ? 'All activity across the workspace' : 'Your meeting activity log'}
          </p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <History size={14} className="text-neutral-400" />
            <span className="text-[13px] font-bold text-black">
              {user.role === 'admin' ? 'All Records' : 'My Records'}
            </span>
            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] font-bold rounded-full">
              {entries.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selected.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all"
              >
                <Trash2 size={12} /> Delete ({selected.size})
              </button>
            )}
            {entries.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-500 hover:text-red-700 border border-red-100 rounded-xl hover:bg-red-50 transition-all"
              >
                <Trash2 size={12} /> Delete All
              </button>
            )}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center">
              <History size={20} className="text-neutral-300" />
            </div>
            <p className="text-[13px] font-semibold text-neutral-400">No history yet</p>
            <p className="text-[12px] text-neutral-300">Meeting activity will appear here</p>
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
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                    Meeting
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 whitespace-nowrap">
                    Room &amp; Slot
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                    Details
                  </th>
                  <th className="pr-5 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {entries.map(h => {
                  const actionInfo = HISTORY_ACTIONS[h.action]
                  return (
                    <tr key={h.id} className="group hover:bg-neutral-50 transition-colors">

                      {/* Checkbox */}
                      <td
                        className="pl-5 py-3.5"
                        onClick={e => { e.stopPropagation(); toggleSelect(h.id) }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(h.id)}
                          onChange={() => toggleSelect(h.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-3.5 h-3.5 accent-black rounded cursor-pointer"
                        />
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-[11px] text-neutral-600 font-medium">{fmtDateTime(h.createdAt)}</p>
                        <p className="text-[10px] text-neutral-400">{timeAgo(h.createdAt)}</p>
                      </td>

                      {/* Action badge */}
                      <td className="px-4 py-3.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap ${actionInfo?.cls ?? 'bg-neutral-100 text-neutral-500'}`}>
                          {actionInfo?.label ?? h.action}
                        </span>
                      </td>

                      {/* Meeting title */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <p className="text-[12px] font-semibold text-black truncate">{h.bookingTitle}</p>
                        {user.role === 'admin' && h.performedBy && (
                          <p className="text-[10px] text-neutral-400 mt-0.5 truncate">by {h.performedBy}</p>
                        )}
                      </td>

                      {/* Room & Slot */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-[11px] text-neutral-600 font-medium">{h.room}</p>
                        <p className="text-[11px] text-neutral-400">
                          {fmtDate(h.date)}
                          {h.startMinutes != null && ` · ${minsToAmPm(h.startMinutes)}–${minsToAmPm(h.endMinutes)}`}
                        </p>
                      </td>

                      {/* Details: rescheduled arrow or reason */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        {h.newDate ? (
                          <p className="text-[11px] text-blue-600 font-medium">
                            → {h.newRoom ?? h.room} · {fmtDate(h.newDate)}
                            {h.newStartMinutes != null && ` · ${minsToAmPm(h.newStartMinutes)}–${minsToAmPm(h.newEndMinutes)}`}
                          </p>
                        ) : h.reason ? (
                          <p className="text-[11px] text-neutral-500 italic line-clamp-2">{h.reason}</p>
                        ) : (
                          <span className="text-[11px] text-neutral-300">—</span>
                        )}
                      </td>

                      {/* Row delete */}
                      <td className="pr-5 py-3.5">
                        <button
                          onClick={e => { e.stopPropagation(); deleteHistoryEntry?.(h.id) }}
                          title="Delete"
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-400 hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
