import { useState } from 'react'
import {
  ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Trash2, Lock,
  CalendarDays, Building2, Mail, User, AlertTriangle, CheckCircle2,
  RotateCcw, History,
  AlertCircle, Briefcase, DoorOpen, X, ThumbsDown,
} from 'lucide-react'
import RescheduleInline from '../components/RescheduleInline'
import {
  updatePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  deleteUser as fbDeleteUser,
} from 'firebase/auth'
import { doc, deleteDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

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

function authErrMsg(code) {
  const map = {
    'auth/wrong-password':        'Current password is incorrect.',
    'auth/invalid-credential':    'Current password is incorrect.',
    'auth/too-many-requests':     'Too many attempts. Please try again later.',
    'auth/requires-recent-login': 'Please log out and log back in first.',
  }
  return map[code] || 'Something went wrong. Please try again.'
}

const STATUS_CONFIG = {
  approved:                    { label: 'Approved',          cls: 'bg-green-100 text-green-700'      },
  pending_priority_approval:   { label: 'Awaiting Approval', cls: 'bg-amber-100 text-amber-700'      },
  // legacy statuses kept for backwards-compatibility with existing Firestore data
  priority_pending:            { label: 'Priority Pending',  cls: 'bg-amber-100 text-amber-700'      },
  waiting_for_action:          { label: 'Action Needed',     cls: 'bg-red-100 text-red-600'          },
  rescheduled:                 { label: 'Rescheduled',       cls: 'bg-blue-100 text-blue-700'        },
  cancelled:                   { label: 'Cancelled',         cls: 'bg-neutral-100 text-neutral-500'  },
  rejected:                    { label: 'Rejected',          cls: 'bg-red-100 text-red-600'          },
  pending:                     { label: 'Pending',           cls: 'bg-neutral-100 text-neutral-500'  },
}

const HISTORY_ACTIONS = {
  created:             { label: 'Created',            cls: 'bg-green-100 text-green-700'     },
  priority_created:    { label: 'Priority Requested', cls: 'bg-amber-100 text-amber-700'     },
  partial_approved:    { label: 'Partially Approved', cls: 'bg-yellow-100 text-yellow-700'   },
  approved:            { label: 'Approved',           cls: 'bg-green-100 text-green-700'     },
  rejected:            { label: 'Rejected',           cls: 'bg-red-100 text-red-600'         },
  withdrawn:           { label: 'Withdrawn',          cls: 'bg-neutral-100 text-neutral-500' },
  deleted_with_reason: { label: 'Deleted',            cls: 'bg-red-100 text-red-600'         },
  rescheduled:         { label: 'Rescheduled',        cls: 'bg-blue-100 text-blue-700'       },
  cancelled:           { label: 'Cancelled',          cls: 'bg-neutral-100 text-neutral-500' },
}

const DELETE_REASONS = [
  'Meeting no longer needed',
  'Client meeting priority',
  'Team unavailable',
  'Schedule conflict',
  'Other',
]

// Inline reschedule form shown below the waiting meeting card

// Inline withdraw-client-booking confirmation
function WithdrawConfirmInline({ booking, onWithdraw, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleWithdraw() {
    setError('')
    setSaving(true)
    try {
      await onWithdraw(booking)
    } catch (err) {
      console.error('Withdraw failed:', err)
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
        <button
          onClick={handleWithdraw}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-[12px] font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
          Yes, Withdraw
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="px-4 py-2 text-[12px] font-semibold text-neutral-500 hover:text-black transition-colors disabled:opacity-40">
          Cancel
        </button>
      </div>
    </div>
  )
}

// Inline delete-with-reason form
function DeleteWithReasonInline({ booking, onDelete, onCancel }) {
  const [reason,      setReason]      = useState('')
  const [customReason, setCustomReason] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

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

      {/* Header */}
      <div className="flex items-start gap-3 px-4 sm:px-5 py-4 bg-red-100/70 border-b border-red-100">
        <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trash2 size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-900 leading-snug">Delete this meeting and free the slot</p>
          <p className="text-xs text-red-600 mt-0.5 leading-snug">The client meeting waiting for this slot will be automatically approved.</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-5 py-4 flex flex-col gap-4">

        {/* Reason picker */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Reason (required)</label>
          <div className="flex flex-wrap gap-2">
            {DELETE_REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { setReason(r); setError('') }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap
                  ${reason === r
                    ? 'border-red-500 bg-red-500 text-white shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-red-300 hover:text-red-700 hover:bg-red-50'}`}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === 'Other' && (
            <input
              type="text"
              placeholder="Describe the reason..."
              value={customReason}
              onChange={e => { setCustomReason(e.target.value); setError('') }}
              className={inputCls}
              required
            />
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60 shadow-sm"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete My Meeting
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-semibold text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>

      </div>
    </form>
  )
}

export default function Profile({
  onNavigate, onLogout, bookings = [], deleteBooking, user,
  notifications = [], meetingHistory = [], markNotificationRead,
  deleteBookingWithReason, rescheduleBooking, cancelClientBooking,
  rejectPriorityRequest,
  rooms = [], settings = {},
}) {
  // Password change
  const [curPass,     setCurPass]     = useState('')
  const [newPass,     setNewPass]     = useState('')
  const [confPass,    setConfPass]    = useState('')
  const [showCur,     setShowCur]     = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConf,    setShowConf]    = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [passError,   setPassError]   = useState('')
  const [passDone,    setPassDone]    = useState(false)

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletePass,    setDeletePass]    = useState('')
  const [showDelPass,   setShowDelPass]   = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState('')

  // Inline action UI state (keyed by booking id)
  const [activeAction,   setActiveAction]   = useState(null) // { id, type: 'reschedule' | 'delete' | 'withdraw' }
  // Per-notification resolve state
  // null → buttons shown | 'resolving' → inline resolve panel | 'cancel-confirm' → cancel + reason input
  // 'reschedule-form' → RescheduleInline | 'rejecting' → reject spinner | 'done' → action complete
  const [approvalState,  setApprovalState]  = useState({})
  const [resolveReason,  setResolveReason]  = useState({})

  const myMeetings = bookings
    .filter(b => b.ownerEmail === user.email)
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startMinutes - b.startMinutes)

  const myHistory = meetingHistory
    .filter(h => h.performedByEmail === user.email)
    .slice(0, 10)

  async function handleChangePassword(e) {
    e.preventDefault()
    setPassError('')
    setPassDone(false)
    if (newPass.length < 6)  return setPassError('New password must be at least 6 characters.')
    if (newPass !== confPass) return setPassError('Passwords do not match.')
    setPassLoading(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, curPass)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPass)
      setCurPass(''); setNewPass(''); setConfPass('')
      setPassDone(true)
    } catch (err) {
      setPassError(authErrMsg(err.code))
    } finally {
      setPassLoading(false)
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault()
    setDeleteError('')
    setDeleteLoading(true)
    try {
      if (user.isGoogleUser) {
        await reauthenticateWithPopup(auth.currentUser, googleProvider)
      } else {
        const credential = EmailAuthProvider.credential(user.email, deletePass)
        await reauthenticateWithCredential(auth.currentUser, credential)
      }
      await Promise.all(myMeetings.map(b => deleteBooking(b.id)))
      await deleteDoc(doc(db, 'users', user.uid))
      await fbDeleteUser(auth.currentUser)
    } catch (err) {
      setDeleteError(authErrMsg(err.code))
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('dashboard')}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors">
          <ArrowLeft size={16} className="text-neutral-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">My Profile</h1>
          <p className="text-sm text-neutral-400">Manage your account and meetings</p>
        </div>
      </div>

      {/* User info card */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-black flex items-center justify-center flex-shrink-0 overflow-hidden">
          {user.photoURL
            ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-white">{user.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
          }
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <User size={13} className="text-neutral-300" />
            <span className="text-[13px] font-semibold text-black">{user.name}</span>
            {user.role === 'admin' && (
              <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold rounded-full uppercase tracking-wide">Admin</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Mail size={13} className="text-neutral-300" />
            <span className="text-[13px] text-neutral-500">{user.email}</span>
          </div>
          {user.company && (
            <div className="flex items-center gap-2">
              <Building2 size={13} className="text-neutral-300" />
              <span className="text-[13px] text-neutral-500">{user.company}</span>
            </div>
          )}
          {user.isGoogleUser && (
            <span className="text-[11px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full w-fit">Signed in with Google</span>
          )}
        </div>
      </div>

      {/* My Meetings */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
          <CalendarDays size={15} className="text-neutral-400" />
          <h2 className="text-[13px] font-bold text-black">My Meetings</h2>
          <span className="ml-auto text-[11px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
            {myMeetings.length}
          </span>
        </div>
        {myMeetings.length === 0 ? (
          <div className="px-6 py-8 flex flex-col items-center gap-2">
            <CalendarDays size={24} className="text-neutral-200" />
            <p className="text-sm text-neutral-400">You have no scheduled meetings</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {myMeetings.map(b => {
              const statusInfo        = STATUS_CONFIG[b.status]
              const isWaiting         = b.status === 'waiting_for_action'
              const isPriorityPending = (b.status === 'pending_priority_approval' || b.status === 'priority_pending') && b.meetingType === 'client'
              const isOpen            = activeAction?.id === b.id
              // How many approvals received vs total needed
              const approvedCount     = isPriorityPending ? (b.approvedConflictIds?.length ?? 0) : 0
              const totalConflicts    = isPriorityPending ? (b.conflictsWithIds?.length ?? 0) : 0

              // Check if a pending priority request from another user is targeting this booking
              const targetingPriority = bookings.find(pb =>
                pb.status === 'pending_priority_approval' &&
                Array.isArray(pb.conflictsWithIds) &&
                pb.conflictsWithIds.includes(b.id)
              )
              const isTargeted = !!targetingPriority
              const aState     = approvalState[b.id]

              // Find the priority_request notification for auto-dismissal after action
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

                  {/* Top row: info + small delete (regular meetings only) */}
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
                      <button
                        onClick={() => deleteBooking(b.id)}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:bg-red-50 hover:text-red-400 transition-colors mt-0.5"
                        title="Delete meeting"
                      >
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
                      {/* Initial buttons */}
                      {!aState && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setApprovalState(s => ({ ...s, [b.id]: 'resolving' }))}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 text-white text-[12px] font-bold rounded-xl hover:bg-amber-600 transition-colors"
                          >
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
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500 text-white text-[12px] font-bold rounded-xl hover:bg-red-600 transition-colors"
                          >
                            <ThumbsDown size={12} /> Reject Request
                          </button>
                        </div>
                      )}

                      {/* Resolve panel */}
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
                              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-[12px] font-bold rounded-xl hover:bg-red-600 transition-colors"
                            >
                              <Trash2 size={12} /> Cancel My Meeting
                            </button>
                            <button
                              onClick={() => setApprovalState(s => ({ ...s, [b.id]: 'reschedule-form' }))}
                              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white text-[12px] font-bold rounded-xl hover:bg-blue-600 transition-colors"
                            >
                              <RotateCcw size={12} /> Reschedule
                            </button>
                            <button
                              onClick={() => setApprovalState(s => ({ ...s, [b.id]: null }))}
                              className="px-3 py-2 text-[12px] text-neutral-500 hover:text-black border border-neutral-200 rounded-xl bg-white transition-colors"
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Cancel with reason */}
                      {aState === 'cancel-confirm' && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3">
                          <p className="text-[12px] font-bold text-red-900">Cancel &ldquo;{b.title || b.meetingName}&rdquo;</p>
                          <textarea
                            rows={2}
                            placeholder="Reason for cancellation (optional)…"
                            value={resolveReason[b.id] ?? ''}
                            onChange={e => setResolveReason(s => ({ ...s, [b.id]: e.target.value }))}
                            className="w-full px-3 py-2 text-[12px] border border-red-200 rounded-xl outline-none focus:border-red-400 resize-none bg-white"
                          />
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
                              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-[12px] font-bold rounded-xl hover:bg-red-700 transition-colors"
                            >
                              <Trash2 size={12} /> Confirm Cancel
                            </button>
                            <button
                              onClick={() => setApprovalState(s => ({ ...s, [b.id]: 'resolving' }))}
                              className="px-3 py-2 text-[12px] text-neutral-500 hover:text-black border border-neutral-200 rounded-xl bg-white transition-colors"
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Reschedule inline form */}
                      {aState === 'reschedule-form' && (
                        <div className="mt-1">
                          <RescheduleInline
                            booking={b}
                            bookings={bookings}
                            rooms={rooms}
                            settings={settings}
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

                      {/* Rejecting spinner */}
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

                  {/* Pending approval hint — pending_priority_approval client meeting */}
                  {isPriorityPending && !isOpen && (
                    <p className="mt-2 text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
                      <AlertCircle size={11} />
                      Awaiting approval from {totalConflicts} owner{totalConflicts !== 1 ? 's' : ''}.
                      {totalConflicts > 0 && approvedCount > 0 && ` ${approvedCount}/${totalConflicts} approved so far.`}
                      {' '}You can withdraw before consensus.
                    </p>
                  )}

                  {/* Action buttons for waiting meetings (legacy) */}
                  {isWaiting && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveAction(isOpen && activeAction?.type === 'reschedule' ? null : { id: b.id, type: 'reschedule' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl transition-colors border
                          ${isOpen && activeAction?.type === 'reschedule'
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}
                      >
                        <RotateCcw size={11} /> Reschedule
                      </button>
                      <button
                        onClick={() => setActiveAction(isOpen && activeAction?.type === 'delete' ? null : { id: b.id, type: 'delete' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl transition-colors border
                          ${isOpen && activeAction?.type === 'delete'
                            ? 'bg-red-100 border-red-300 text-red-800'
                            : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'}`}
                      >
                        <Trash2 size={11} /> Delete Mine
                      </button>
                    </div>
                  )}

                  {/* Withdraw button for priority_pending client meetings */}
                  {isPriorityPending && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveAction(isOpen && activeAction?.type === 'withdraw' ? null : { id: b.id, type: 'withdraw' })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl transition-colors border
                          ${isOpen && activeAction?.type === 'withdraw'
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
                      >
                        <X size={11} /> Withdraw Request
                      </button>
                    </div>
                  )}

                  {/* Inline action panels */}
                  {isOpen && activeAction?.type === 'reschedule' && (
                    <RescheduleInline
                      booking={b}
                      bookings={bookings}
                      rooms={rooms}
                      settings={settings}
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

      {/* Meeting History */}
      {myHistory.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
            <History size={15} className="text-neutral-400" />
            <h2 className="text-[13px] font-bold text-black">Meeting History</h2>
            <span className="ml-auto text-[11px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
              {myHistory.length} / 10
            </span>
          </div>
          <div className="divide-y divide-neutral-100">
            {myHistory.map(h => {
              const actionInfo = HISTORY_ACTIONS[h.action]
              return (
                <div key={h.id} className="px-6 py-3.5 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${actionInfo?.cls ?? 'bg-neutral-100 text-neutral-500'}`}>
                        {actionInfo?.label ?? h.action}
                      </span>
                      <span className="text-[11px] font-semibold text-black truncate">{h.bookingTitle}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {h.room} · {h.date && fmtDate(h.date)}
                      {h.startMinutes != null && ` · ${minsToAmPm(h.startMinutes)}–${minsToAmPm(h.endMinutes)}`}
                    </p>
                    {h.newDate && (
                      <p className="text-[11px] text-blue-600 mt-0.5">
                        → {h.newRoom ?? h.room} · {fmtDate(h.newDate)} · {minsToAmPm(h.newStartMinutes)}–{minsToAmPm(h.newEndMinutes)}
                      </p>
                    )}
                    {h.reason && (
                      <p className="text-[11px] text-neutral-500 mt-0.5 italic">Reason: {h.reason}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 flex-shrink-0 pt-0.5">{timeAgo(h.createdAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Change Password */}
      {!user.isGoogleUser && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
            <Lock size={15} className="text-neutral-400" />
            <h2 className="text-[13px] font-bold text-black">Change Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="px-6 py-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Current Password', val: curPass,  set: setCurPass,  show: showCur,  toggle: () => setShowCur(v => !v)  },
                { label: 'New Password',      val: newPass,  set: setNewPass,  show: showNew,  toggle: () => setShowNew(v => !v)  },
                { label: 'Confirm Password',  val: confPass, set: setConfPass, show: showConf, toggle: () => setShowConf(v => !v) },
              ].map(({ label, val, set, show, toggle }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{label}</label>
                  <div className="relative">
                    <input type={show ? 'text' : 'password'} value={val}
                      onChange={e => set(e.target.value)} className={inputCls + ' pr-10'} placeholder="••••••••" required />
                    <button type="button" onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-black transition-colors">
                      {show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {passError && <p className="text-xs text-red-500">{passError}</p>}
            {passDone && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle2 size={13} /> Password updated successfully.
              </div>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={passLoading}
                className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-black rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {passLoading ? <Loader2 size={13} className="animate-spin" /> : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Google users */}
      {user.isGoogleUser && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 flex items-center gap-4">
          <Lock size={18} className="text-neutral-300 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-black">Password managed by Google</p>
            <p className="text-[12px] text-neutral-400 mt-0.5">Manage your password through your Google account settings.</p>
          </div>
        </div>
      )}

      {/* Delete Account */}
      <div className="bg-white border border-red-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-400" />
          <h2 className="text-[13px] font-bold text-red-500">Delete Account</h2>
        </div>
        <div className="px-6 py-5">
          {!deleteConfirm ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <p className="text-[13px] text-neutral-500">Permanently removes your account and all your meetings. This cannot be undone.</p>
              <button onClick={() => setDeleteConfirm(true)}
                className="self-start sm:self-auto flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 active:scale-[0.98] transition-all">
                <Trash2 size={13} /> Delete Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4">
              <p className="text-[13px] text-neutral-600 font-medium">
                {user.isGoogleUser
                  ? 'Click below to re-authenticate with Google and confirm deletion.'
                  : 'Enter your password to confirm account deletion.'}
              </p>
              {!user.isGoogleUser && (
                <div className="relative max-w-xs">
                  <input type={showDelPass ? 'text' : 'password'} value={deletePass}
                    onChange={e => setDeletePass(e.target.value)} className={inputCls + ' pr-10'} placeholder="Your password" required />
                  <button type="button" onClick={() => setShowDelPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-black transition-colors">
                    {showDelPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )}
              {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={deleteLoading}
                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {deleteLoading ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> Confirm Delete</>}
                </button>
                <button type="button" onClick={() => { setDeleteConfirm(false); setDeletePass(''); setDeleteError('') }}
                  className="px-5 py-2.5 text-[13px] font-semibold text-neutral-500 rounded-xl hover:bg-neutral-100 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
