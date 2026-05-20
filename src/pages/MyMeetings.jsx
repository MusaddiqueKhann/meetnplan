import { useState } from 'react'
import {
  ArrowLeft, ArrowRight, Loader2, Trash2,
  CalendarDays, RotateCcw,
  AlertCircle, Briefcase, DoorOpen, X, ThumbsDown,
} from 'lucide-react'
import RescheduleInline from '../components/RescheduleInline'

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white ' +
  'focus:outline-none focus:border-black focus:ring-1 focus:ring-black ' +
  'transition-all placeholder:text-neutral-300'

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
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_CONFIG = {
  approved:                  { label: 'Approved',          cls: 'bg-green-100 text-green-700'     },
  pending_priority_approval: { label: 'Awaiting Approval', cls: 'bg-amber-100 text-amber-700'     },
  priority_pending:          { label: 'Priority Pending',  cls: 'bg-amber-100 text-amber-700'     },
  waiting_for_action:        { label: 'Action Needed',     cls: 'bg-red-100 text-red-600'         },
  rescheduled:               { label: 'Rescheduled',       cls: 'bg-blue-100 text-blue-700'       },
  cancelled:                 { label: 'Cancelled',         cls: 'bg-neutral-100 text-neutral-500' },
  rejected:                  { label: 'Rejected',          cls: 'bg-red-100 text-red-600'         },
  pending:                   { label: 'Pending',           cls: 'bg-neutral-100 text-neutral-500' },
}

const DELETE_REASONS = [
  'Meeting no longer needed',
  'Client meeting priority',
  'Team unavailable',
  'Schedule conflict',
  'Other',
]

function WithdrawConfirmInline({ booking, onWithdraw, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleWithdraw() {
    setError('')
    setSaving(true)
    try {
      await onWithdraw(booking)
    } catch (err) {
      setError(err?.message || 'Failed to withdraw. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-[12px] font-bold text-amber-800">Withdraw this client meeting request?</p>
      <p className="text-[11px] text-amber-700">
        The request will be deleted and all conflicting meetings will be restored. This cannot be undone.
      </p>
      {error && <p className="text-[11px] text-red-600 font-semibold">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={handleWithdraw} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-[12px] font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
          Yes, Withdraw
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2 text-[12px] font-semibold text-neutral-500 hover:text-black transition-colors disabled:opacity-40">
          Cancel
        </button>
      </div>
    </div>
  )
}

function DeleteWithReasonInline({ booking, onDelete, onCancel }) {
  const [reason,       setReason]       = useState('')
  const [customReason, setCustomReason] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const finalReason = reason === 'Other' ? customReason.trim() : reason
    if (!finalReason) { setError('Please select or enter a reason.'); return }
    setSaving(true)
    try {
      await onDelete(booking, finalReason)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 bg-red-50 border border-red-100 rounded-2xl overflow-hidden">
      <div className="flex items-start gap-3 px-4 sm:px-5 py-4 bg-red-100/70 border-b border-red-100">
        <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trash2 size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-900 leading-snug">Delete this meeting and free the slot</p>
          <p className="text-xs text-red-600 mt-0.5 leading-snug">The client meeting waiting for this slot will be automatically approved.</p>
        </div>
      </div>
      <div className="px-4 sm:px-5 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Reason (required)</label>
          <div className="flex flex-wrap gap-2">
            {DELETE_REASONS.map(r => (
              <button key={r} type="button" onClick={() => { setReason(r); setError('') }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap
                  ${reason === r
                    ? 'border-red-500 bg-red-500 text-white shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-red-300 hover:text-red-700 hover:bg-red-50'}`}>
                {r}
              </button>
            ))}
          </div>
          {reason === 'Other' && (
            <input type="text" placeholder="Describe the reason..."
              value={customReason}
              onChange={e => { setCustomReason(e.target.value); setError('') }}
              className={inputCls} required />
          )}
        </div>
        {error && (
          <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60 shadow-sm">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete My Meeting
          </button>
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 text-xs font-semibold text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-xl transition-all">
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}

export default function MyMeetings({
  bookings = [], user, notifications = [], markNotificationRead,
  deleteBooking, deleteBookingWithReason, rescheduleBooking,
  cancelClientBooking, rejectPriorityRequest,
  rooms = [], settings = {}, onNavigate,
}) {
  const [activeAction,  setActiveAction]  = useState(null) // { id, type: 'reschedule'|'delete'|'withdraw' }
  const [approvalState, setApprovalState] = useState({})   // keyed by booking id
  const [resolveReason, setResolveReason] = useState({})   // keyed by booking id

  const myMeetings = bookings
    .filter(b => b.ownerEmail === user.email)
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startMinutes - b.startMinutes)

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('dashboard')}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors">
          <ArrowLeft size={16} className="text-neutral-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">My Meetings</h1>
          <p className="text-sm text-neutral-400">Manage and act on your scheduled meetings</p>
        </div>
      </div>

      {/* Meeting list card */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
          <CalendarDays size={15} className="text-neutral-400" />
          <h2 className="text-[13px] font-bold text-black">All Meetings</h2>
          <span className="ml-auto text-[11px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
            {myMeetings.length}
          </span>
        </div>

        {myMeetings.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center">
              <CalendarDays size={20} className="text-neutral-300" />
            </div>
            <p className="text-[13px] font-semibold text-neutral-400">No scheduled meetings</p>
            <p className="text-[12px] text-neutral-300">Your meetings will appear here once booked</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {myMeetings.map(b => {
              const statusInfo        = STATUS_CONFIG[b.status]
              const isWaiting         = b.status === 'waiting_for_action'
              const isPriorityPending = (b.status === 'pending_priority_approval' || b.status === 'priority_pending') && b.meetingType === 'client'
              const isOpen            = activeAction?.id === b.id
              const approvedCount     = isPriorityPending ? (b.approvedConflictIds?.length ?? 0) : 0
              const totalConflicts    = isPriorityPending ? (b.conflictsWithIds?.length ?? 0) : 0

              const targetingPriority = bookings.find(pb =>
                pb.status === 'pending_priority_approval' &&
                Array.isArray(pb.conflictsWithIds) &&
                pb.conflictsWithIds.includes(b.id)
              )
              const isTargeted    = !!targetingPriority
              const aState        = approvalState[b.id]
              const targetingNotif = isTargeted
                ? notifications.find(n => n.type === 'priority_request' && n.bookingId === b.id && !n.read)
                : null

              return (
                <div key={b.id} className={`px-4 sm:px-6 py-4 transition-colors ${
                  isWaiting ? 'bg-red-50/30' :
                  isTargeted ? 'bg-amber-50/20' :
                  isPriorityPending ? 'bg-amber-50/30' :
                  'hover:bg-neutral-50'
                }`}>

                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-[13px] font-semibold text-black truncate">{b.title || b.meetingName}</p>
                        {b.meetingType === 'client' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full uppercase tracking-wide flex items-center gap-1 flex-shrink-0">
                            <Briefcase size={9} /> Client
                          </span>
                        )}
                        {statusInfo && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${statusInfo.cls}`}>
                            {statusInfo.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        {fmtDate(b.date)} · {minsToAmPm(b.startMinutes)}–{minsToAmPm(b.endMinutes)}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                        <DoorOpen size={10} /> {b.room}
                        {b.clientName && <><span className="mx-1">·</span><span className="text-amber-600 font-medium">Client: {b.clientName}</span></>}
                      </p>
                    </div>
                    {!isWaiting && !isPriorityPending && !isTargeted && (
                      <button onClick={() => deleteBooking(b.id)}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:bg-red-50 hover:text-red-400 transition-colors mt-0.5"
                        title="Delete meeting">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Conflict alert — targeted by a pending priority request */}
                  {isTargeted && aState !== 'done' && (
                    <p className="mt-2 text-[11px] text-amber-700 font-medium flex items-center gap-1.5">
                      <AlertCircle size={11} />
                      A client meeting &ldquo;{targetingPriority.title}&rdquo; is requesting this slot.
                      {targetingPriority.coordinator && ` Requested by ${targetingPriority.coordinator}.`}
                    </p>
                  )}

                  {/* Resolve / Reject actions for targeted meetings */}
                  {isTargeted && aState !== 'done' && (
                    <div className="mt-3">
                      {!aState && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setApprovalState(s => ({ ...s, [b.id]: 'resolving' }))}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 text-white text-[12px] font-bold rounded-xl hover:bg-amber-600 transition-colors">
                            <ArrowRight size={12} /> Resolve Conflict
                          </button>
                          <button
                            onClick={async () => {
                              setApprovalState(s => ({ ...s, [b.id]: 'rejecting' }))
                              try {
                                await rejectPriorityRequest?.(targetingPriority.id, user.email)
                                if (targetingNotif?.id) await markNotificationRead?.(targetingNotif.id)
                                setApprovalState(s => ({ ...s, [b.id]: 'done' }))
                              } catch {
                                setApprovalState(s => ({ ...s, [b.id]: null }))
                              }
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500 text-white text-[12px] font-bold rounded-xl hover:bg-red-600 transition-colors">
                            <ThumbsDown size={12} /> Reject Request
                          </button>
                        </div>
                      )}

                      {aState === 'resolving' && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-3">
                          <div>
                            <p className="text-[12px] font-bold text-amber-900">Resolve conflict for your meeting</p>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              Cancel or reschedule your meeting. Once the slot is free, the priority request confirms automatically.
                            </p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setApprovalState(s => ({ ...s, [b.id]: 'cancel-confirm' }))}
                              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-[12px] font-bold rounded-xl hover:bg-red-600 transition-colors">
                              <Trash2 size={12} /> Cancel My Meeting
                            </button>
                            <button
                              onClick={() => setApprovalState(s => ({ ...s, [b.id]: 'reschedule-form' }))}
                              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white text-[12px] font-bold rounded-xl hover:bg-blue-600 transition-colors">
                              <RotateCcw size={12} /> Reschedule
                            </button>
                            <button
                              onClick={() => setApprovalState(s => ({ ...s, [b.id]: null }))}
                              className="px-3 py-2 text-[12px] text-neutral-500 hover:text-black border border-neutral-200 rounded-xl bg-white transition-colors">
                              Back
                            </button>
                          </div>
                        </div>
                      )}

                      {aState === 'cancel-confirm' && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3">
                          <p className="text-[12px] font-bold text-red-900">Cancel &ldquo;{b.title || b.meetingName}&rdquo;</p>
                          <textarea rows={2} placeholder="Reason for cancellation (optional)…"
                            value={resolveReason[b.id] ?? ''}
                            onChange={e => setResolveReason(s => ({ ...s, [b.id]: e.target.value }))}
                            className="w-full px-3 py-2 text-[12px] border border-red-200 rounded-xl outline-none focus:border-red-400 resize-none bg-white" />
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  const reason = resolveReason[b.id]?.trim() || 'Resolved conflict for priority client request'
                                  await deleteBookingWithReason?.(b, reason)
                                  if (targetingNotif?.id) await markNotificationRead?.(targetingNotif.id)
                                  setApprovalState(s => ({ ...s, [b.id]: 'done' }))
                                } catch {
                                  setApprovalState(s => ({ ...s, [b.id]: 'resolving' }))
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-[12px] font-bold rounded-xl hover:bg-red-700 transition-colors">
                              <Trash2 size={12} /> Confirm Cancel
                            </button>
                            <button onClick={() => setApprovalState(s => ({ ...s, [b.id]: 'resolving' }))}
                              className="px-3 py-2 text-[12px] text-neutral-500 hover:text-black border border-neutral-200 rounded-xl bg-white transition-colors">
                              Back
                            </button>
                          </div>
                        </div>
                      )}

                      {aState === 'reschedule-form' && (
                        <div className="mt-1">
                          <RescheduleInline
                            booking={b} bookings={bookings} rooms={rooms} settings={settings}
                            onReschedule={async (bk, newData) => {
                              try {
                                await rescheduleBooking?.(bk, newData)
                                if (targetingNotif?.id) await markNotificationRead?.(targetingNotif.id)
                                setApprovalState(s => ({ ...s, [b.id]: 'done' }))
                              } catch {
                                setApprovalState(s => ({ ...s, [b.id]: 'resolving' }))
                              }
                            }}
                            onCancel={() => setApprovalState(s => ({ ...s, [b.id]: 'resolving' }))}
                          />
                        </div>
                      )}

                      {aState === 'rejecting' && (
                        <div className="flex items-center gap-2 text-[12px] text-neutral-500 mt-2">
                          <Loader2 size={12} className="animate-spin" /> Rejecting request…
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action needed hint — waiting for action (legacy) */}
                  {isWaiting && !isOpen && (
                    <p className="mt-2 text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle size={11} />
                      A client meeting has priority on this slot. Please reschedule or delete your meeting.
                    </p>
                  )}

                  {/* Pending approval hint */}
                  {isPriorityPending && !isOpen && (
                    <p className="mt-2 text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
                      <AlertCircle size={11} />
                      Awaiting approval from {totalConflicts} owner{totalConflicts !== 1 ? 's' : ''}.
                      {totalConflicts > 0 && approvedCount > 0 && ` ${approvedCount}/${totalConflicts} approved so far.`}
                      {' '}You can withdraw before consensus.
                    </p>
                  )}

                  {/* Action buttons for legacy waiting_for_action meetings */}
                  {isWaiting && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveAction(isOpen && activeAction?.type === 'reschedule' ? null : { id: b.id, type: 'reschedule' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl transition-colors border
                          ${isOpen && activeAction?.type === 'reschedule'
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                        <RotateCcw size={11} /> Reschedule
                      </button>
                      <button
                        onClick={() => setActiveAction(isOpen && activeAction?.type === 'delete' ? null : { id: b.id, type: 'delete' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl transition-colors border
                          ${isOpen && activeAction?.type === 'delete'
                            ? 'bg-red-100 border-red-300 text-red-800'
                            : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}>
                        <Trash2 size={11} /> Delete Mine
                      </button>
                    </div>
                  )}

                  {/* Withdraw button for client meetings awaiting approval */}
                  {isPriorityPending && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveAction(isOpen && activeAction?.type === 'withdraw' ? null : { id: b.id, type: 'withdraw' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl transition-colors border
                          ${isOpen && activeAction?.type === 'withdraw'
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}>
                        <X size={11} /> Withdraw Request
                      </button>
                    </div>
                  )}

                  {/* Inline action panels */}
                  {isOpen && activeAction?.type === 'reschedule' && (
                    <RescheduleInline
                      booking={b} bookings={bookings} rooms={rooms} settings={settings}
                      onReschedule={async (bk, newData) => {
                        await rescheduleBooking(bk, newData)
                        setActiveAction(null)
                      }}
                      onCancel={() => setActiveAction(null)}
                    />
                  )}
                  {isOpen && activeAction?.type === 'delete' && (
                    <DeleteWithReasonInline
                      booking={b}
                      onDelete={async (bk, reason) => {
                        await deleteBookingWithReason(bk, reason)
                        setActiveAction(null)
                      }}
                      onCancel={() => setActiveAction(null)}
                    />
                  )}
                  {isOpen && activeAction?.type === 'withdraw' && (
                    <WithdrawConfirmInline
                      booking={b}
                      onWithdraw={async (bk) => {
                        await cancelClientBooking(bk)
                        setActiveAction(null)
                      }}
                      onCancel={() => setActiveAction(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
