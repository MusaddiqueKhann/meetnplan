import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft, Eye, EyeOff, Loader2, Trash2, Lock,
  CalendarDays, Building2, Mail, User, AlertTriangle, CheckCircle2,
  Bell, Clock, ChevronDown, RotateCcw, History, CheckCheck,
  AlertCircle, Briefcase, DoorOpen, X, Users,
} from 'lucide-react'
import DatePicker from '../components/ui/DatePicker'
import TimePicker from '../components/ui/TimePicker'
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
function toMinutes(time) {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  approved:           { label: 'Approved',         cls: 'bg-green-100 text-green-700'       },
  priority_pending:   { label: 'Priority Pending',  cls: 'bg-amber-100 text-amber-700'       },
  waiting_for_action: { label: 'Action Needed',     cls: 'bg-red-100 text-red-600'           },
  rescheduled:        { label: 'Rescheduled',        cls: 'bg-blue-100 text-blue-700'         },
  cancelled:          { label: 'Cancelled',          cls: 'bg-neutral-100 text-neutral-500'  },
  pending:            { label: 'Pending',            cls: 'bg-neutral-100 text-neutral-500'  },
}

const HISTORY_ACTIONS = {
  created:             { label: 'Created',            cls: 'bg-green-100 text-green-700'  },
  priority_created:    { label: 'Priority Requested', cls: 'bg-amber-100 text-amber-700'  },
  approved:            { label: 'Approved',           cls: 'bg-green-100 text-green-700'  },
  deleted_with_reason: { label: 'Deleted',            cls: 'bg-red-100 text-red-600'      },
  rescheduled:         { label: 'Rescheduled',        cls: 'bg-blue-100 text-blue-700'    },
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
function RescheduleInline({ booking, bookings, rooms, settings, onReschedule, onCancel }) {
  const workStartHour = settings.workStartHour ?? 8
  const workEndHour   = settings.workEndHour   ?? 20
  const offDays       = settings.offDays       ?? [5, 6]
  const maxDaysAhead  = settings.maxDaysAhead  ?? 30

  const [date,     setDate]     = useState(booking.date)
  const [time,     setTime]     = useState('')
  const [room,     setRoom]     = useState(booking.room)
  const [roomOpen, setRoomOpen] = useState(false)
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const roomRef = useRef(null)

  useEffect(() => {
    const h = (e) => { if (roomRef.current && !roomRef.current.contains(e.target)) setRoomOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function maxDateStr() {
    const d = new Date()
    d.setDate(d.getDate() + maxDaysAhead)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const now              = new Date()
  const isSelectedToday  = date === todayStr()
  const dur              = booking.endMinutes - booking.startMinutes
  const durLabel         = `${Math.floor(dur / 60) > 0 ? `${Math.floor(dur / 60)}h ` : ''}${dur % 60 > 0 ? `${dur % 60}m` : ''}`.trim()
  const effectiveMinHour = isSelectedToday ? Math.max(workStartHour, now.getHours()) : workStartHour
  // Latest hour where the meeting still ends within work hours (duration-aware)
  const effectiveMaxHour = Math.floor((workEndHour * 60 - dur) / 60) + 1

  function validate() {
    if (!date || !time || !room) return 'Please fill in all fields.'
    const startMins = toMinutes(time)
    const endMins   = startMins + dur
    const d         = new Date(date + 'T00:00:00')
    if (offDays.includes(d.getDay())) return 'That day is not a working day.'
    if (startMins < workStartHour * 60) return `Must start after ${workStartHour}:00.`
    if (endMins > workEndHour * 60)     return `Must end before ${workEndHour}:00.`
    if (date === todayStr()) {
      const freshNow = new Date()
      if (startMins <= freshNow.getHours() * 60 + freshNow.getMinutes())
        return 'Please choose a future time.'
    }
    const conflict = bookings.find(b =>
      b.id !== booking.id && b.room === room && b.date === date &&
      b.status !== 'cancelled' && startMins < b.endMinutes && endMins > b.startMinutes
    )
    if (conflict) return `${room} is already booked at that time.`
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    try {
      const startMinutes = toMinutes(time)
      await onReschedule(booking, { date, room, startMinutes, endMinutes: startMinutes + dur })
    } finally {
      setSaving(false)
    }
  }

  const fieldCls = 'w-full px-3 py-2.5 bg-[#F9F9F9] border border-[#E5E5E5] rounded-xl text-[13px] text-black outline-none focus:border-black focus:bg-white transition-colors cursor-pointer flex items-center justify-between'
  const labelCls = 'flex items-center gap-1 text-[10px] font-bold text-black uppercase tracking-wide mb-1'

  return (
    <form onSubmit={handleSubmit} className="mt-3 bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#F0F0F0] bg-[#FAFAFA] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <RotateCcw size={12} className="text-black" />
          <p className="text-[12px] font-bold text-black">Reschedule Meeting</p>
        </div>
        <span className="text-[10px] text-neutral-400 font-medium bg-neutral-100 px-2 py-0.5 rounded-full">{durLabel}</span>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Date + Time — always side by side */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}><CalendarDays size={10} /> Date</label>
            <DatePicker
              value={date}
              onChange={e => { setDate(e.target.value); setError('') }}
              required
              minDate={todayStr()}
              maxDate={maxDateStr()}
              offDays={offDays}
            />
          </div>
          <div>
            <label className={labelCls}><Clock size={10} /> Time</label>
            <TimePicker
              value={time}
              onChange={e => { setTime(e.target.value); setError('') }}
              required
              minHour={effectiveMinHour}
              maxHour={effectiveMaxHour}
              dropUp
            />
          </div>
        </div>

        {/* Room */}
        <div ref={roomRef}>
          <label className={labelCls}><DoorOpen size={10} /> Room</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setRoomOpen(v => !v)}
              className={`${fieldCls} ${!room ? 'text-[#999]' : 'text-black'}`}
            >
              <span className="text-[13px] font-medium truncate">
                {room
                  ? `${room} · ${rooms.find(r => r.name === room)?.capacity ?? ''} seats`
                  : 'Select room'}
              </span>
              <ChevronDown size={13} className={`flex-shrink-0 text-[#999] transition-transform duration-150 ${roomOpen ? 'rotate-180' : ''}`} />
            </button>
            <input type="text" required readOnly value={room} onChange={() => {}} className="sr-only" tabIndex={-1} />
            {roomOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-[200] overflow-hidden">
                {rooms.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRoom(r.name); setRoomOpen(false); setError('') }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#F9F9F9] transition-colors ${room === r.name ? 'bg-[#F5F5F5]' : ''}`}
                  >
                    <span className={`text-[12px] font-semibold ${room === r.name ? 'text-black' : 'text-[#333]'}`}>{r.name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-[#999] font-medium flex-shrink-0">
                      <Users size={10} /> {r.capacity} seats
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={11} className="text-red-500 flex-shrink-0" />
            <p className="text-[11px] text-red-600 font-semibold">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-black text-white text-[12px] font-semibold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Confirm
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-[12px] font-semibold text-neutral-500 hover:text-black transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}

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
    <form onSubmit={handleSubmit} className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
      <p className="text-[12px] font-bold text-red-800">Delete this meeting and free the slot</p>
      <p className="text-[11px] text-red-700">The client meeting waiting for this slot will be automatically approved.</p>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Reason (required)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DELETE_REASONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => { setReason(r); setError('') }}
              className={`px-3 py-2 rounded-xl text-left text-[12px] font-semibold border-2 transition-all
                ${reason === r ? 'border-red-500 bg-red-100 text-red-800' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'}`}
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
      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-[12px] font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Delete My Meeting
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-[12px] font-semibold text-neutral-500 hover:text-black transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function Profile({
  onNavigate, onLogout, bookings = [], deleteBooking, user,
  notifications = [], meetingHistory = [], markNotificationRead,
  deleteBookingWithReason, rescheduleBooking, cancelClientBooking,
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
  const [activeAction, setActiveAction] = useState(null) // { id, type: 'reschedule' | 'delete' }

  const myMeetings = bookings
    .filter(b => b.ownerEmail === user.email)
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startMinutes - b.startMinutes)

  const myHistory = meetingHistory
    .filter(h => h.performedByEmail === user.email)
    .slice(0, 10)

  const unreadNotifs = notifications.filter(n => !n.read)

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

  const typeColor = {
    priority_request:    'bg-amber-500',
    meeting_approved:    'bg-green-500',
    meeting_cancelled:   'bg-red-500',
    meeting_rescheduled: 'bg-blue-500',
    admin_override:      'bg-red-700',
  }
  const typeLabel = {
    priority_request:    '⚡ Priority Request',
    meeting_approved:    '✓ Meeting Approved',
    meeting_cancelled:   '✕ Cancelled',
    meeting_rescheduled: '↗ Rescheduled',
    admin_override:      '⚠ Deleted by Admin',
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

      {/* Notifications */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
          <Bell size={15} className="text-neutral-400" />
          <h2 className="text-[13px] font-bold text-black">Notifications</h2>
          {unreadNotifs.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">{unreadNotifs.length}</span>
          )}
          {notifications.some(n => !n.read) && (
            <button
              onClick={() => notifications.filter(n => !n.read).forEach(n => markNotificationRead?.(n.id))}
              className="ml-auto flex items-center gap-1 text-[11px] text-neutral-400 hover:text-black transition-colors font-semibold"
            >
              <CheckCheck size={12} /> Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="px-6 py-8 flex flex-col items-center gap-2">
            <Bell size={24} className="text-neutral-200" />
            <p className="text-sm text-neutral-400">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {notifications.slice(0, 20).map(n => (
              <div
                key={n.id}
                className={`px-6 py-4 flex items-start gap-4 ${!n.read ? 'bg-blue-50/40' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 ${n.read ? 'bg-transparent' : 'bg-blue-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white ${typeColor[n.type] ?? 'bg-neutral-400'}`}>
                      {typeLabel[n.type] ?? n.type}
                    </span>
                    <span className="text-[10px] text-neutral-400">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-[13px] font-medium text-black">{n.message}</p>
                  {n.existingMeetingTitle && (
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Your meeting: &ldquo;{n.existingMeetingTitle}&rdquo; · {n.room} · {n.date}
                      {n.startMinutes != null && ` · ${minsToAmPm(n.startMinutes)}–${minsToAmPm(n.endMinutes)}`}
                    </p>
                  )}
                  {n.clientName && (
                    <p className="text-[11px] text-amber-700 mt-0.5 font-medium">Client: {n.clientName}</p>
                  )}
                </div>
                {!n.read && (
                  <button
                    onClick={() => markNotificationRead?.(n.id)}
                    className="text-[11px] text-neutral-400 hover:text-black transition-colors font-semibold flex-shrink-0"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
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
              const isPriorityPending = b.status === 'priority_pending' && b.meetingType === 'client'
              const isOpen            = activeAction?.id === b.id

              return (
                <div key={b.id} className={`px-4 sm:px-6 py-4 transition-colors ${isWaiting ? 'bg-red-50/30' : isPriorityPending ? 'bg-amber-50/30' : 'hover:bg-neutral-50'}`}>

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

                    {!isWaiting && !isPriorityPending && (
                      <button
                        onClick={() => deleteBooking(b.id)}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:bg-red-50 hover:text-red-400 transition-colors mt-0.5"
                        title="Delete meeting"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Action needed hint — waiting for action */}
                  {isWaiting && !isOpen && (
                    <p className="mt-2 text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle size={11} />
                      A client meeting has priority on this slot. Please reschedule or delete your meeting.
                    </p>
                  )}

                  {/* Pending approval hint — priority_pending client meeting */}
                  {isPriorityPending && !isOpen && (
                    <p className="mt-2 text-[11px] text-amber-600 font-medium flex items-center gap-1">
                      <AlertCircle size={11} />
                      This client meeting is awaiting approval. You can withdraw it before it gets approved.
                    </p>
                  )}

                  {/* Action buttons for waiting meetings */}
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
