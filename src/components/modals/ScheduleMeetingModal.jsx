import { useState, useRef, useEffect } from 'react'
import { X, Type, CalendarDays, Clock, Timer, DoorOpen, AlertCircle, ChevronDown, Users } from 'lucide-react'
import DatePicker from '../ui/DatePicker'
import TimePicker from '../ui/TimePicker'

const DURATIONS = ['15 min', '30 min', '45 min', '1 hour', '1.5 hours', '2 hours', '3 hours']

const DURATION_MINUTES = {
  '15 min': 15, '30 min': 30, '45 min': 45,
  '1 hour': 60, '1.5 hours': 90, '2 hours': 120, '3 hours': 180,
}

function toMinutes(time) {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function checkConflict(form, bookings) {
  if (!form.room || !form.date || !form.time || !form.duration) return null
  const newStart = toMinutes(form.time)
  const newEnd   = newStart + (DURATION_MINUTES[form.duration] || 0)
  return bookings.find(b =>
    b.room === form.room &&
    b.date === form.date &&
    newStart < b.endMinutes &&
    newEnd   > b.startMinutes
  ) || null
}

function formatMinutes(m) {
  const h   = Math.floor(m / 60)
  const min = String(m % 60).padStart(2, '0')
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${min} ${period}`
}

function fmtWeekDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ScheduleMeetingModal({ isOpen, onClose, rooms = [], bookings = [], onBook, weekStart, weekEnd, user, settings = {} }) {
  const sessionName    = user?.name    ?? ''
  const sessionCompany = user?.company ?? ''

  const workStartHour          = settings.workStartHour          ?? 8
  const workEndHour            = settings.workEndHour            ?? 20
  const maxDaysAhead           = settings.maxDaysAhead           ?? 30
  const maxBookingDurationMins = settings.maxBookingDurationMins ?? 180
  const offDays                = settings.offDays                ?? [5, 6]

  const allowedDurations = DURATIONS.filter(d => DURATION_MINUTES[d] <= maxBookingDurationMins)

  function maxDateStr() {
    const d = new Date()
    d.setDate(d.getDate() + maxDaysAhead)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const [form, setForm] = useState({
    meetingName: '',
    room: '', date: '', time: '', duration: '',
  })
  const [roomOpen,      setRoomOpen]      = useState(false)
  const [durationOpen,  setDurationOpen]  = useState(false)
  const [bookingError,  setBookingError]  = useState('')
  const roomRef     = useRef(null)
  const durationRef = useRef(null)

  useEffect(() => {
    if (!roomOpen) return
    const handler = (e) => {
      if (roomRef.current && !roomRef.current.contains(e.target)) setRoomOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [roomOpen])

  useEffect(() => {
    if (!durationOpen) return
    const handler = (e) => {
      if (durationRef.current && !durationRef.current.contains(e.target)) setDurationOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [durationOpen])

  if (!isOpen) return null

  const set = (field) => (e) => { setBookingError(''); setForm((f) => ({ ...f, [field]: e.target.value })) }

  const now              = new Date()
  const nowTotalMinutes  = now.getHours() * 60 + now.getMinutes()
  const isSelectedToday  = form.date === todayStr()
  const effectiveMinHour = isSelectedToday ? Math.max(workStartHour, now.getHours()) : workStartHour
  const isPastTime       = isSelectedToday && !!form.time && toMinutes(form.time) <= nowTotalMinutes

  const conflict = checkConflict(form, bookings)

  const handleSubmit = (e) => {
    e.preventDefault()
    setBookingError('')
    if (conflict) return
    if (!user?.email) { onClose(); return }

    const startMinutes   = toMinutes(form.time)
    const durationMins   = DURATION_MINUTES[form.duration] || 0
    const endMinutes     = startMinutes + durationMins
    const selectedDate   = new Date(form.date + 'T00:00:00')

    // Validate past time
    if (form.date === todayStr()) {
      const freshNow = new Date()
      if (startMinutes <= freshNow.getHours() * 60 + freshNow.getMinutes()) {
        setBookingError('Please select a time in the future.')
        return
      }
    }

    // Validate off days
    if (offDays.includes(selectedDate.getDay())) {
      setBookingError('That day is not a working day.')
      return
    }

    // Validate max days ahead
    const maxD = new Date(); maxD.setDate(maxD.getDate() + maxDaysAhead)
    maxD.setHours(23, 59, 59, 999)
    if (selectedDate > maxD) {
      setBookingError(`Bookings can only be made up to ${maxDaysAhead} days in advance.`)
      return
    }

    // Validate working hours
    if (startMinutes < workStartHour * 60) {
      setBookingError(`Meetings cannot start before ${toHourLabel(workStartHour)}.`)
      return
    }
    if (endMinutes > workEndHour * 60) {
      setBookingError(`Meeting must end by ${toHourLabel(workEndHour)}.`)
      return
    }

    // Validate max duration
    if (durationMins > maxBookingDurationMins) {
      setBookingError(`Maximum booking duration is ${maxBookingDurationMins} minutes.`)
      return
    }

    onBook?.({
      id:          Date.now(),
      title:       form.meetingName,
      room:        form.room,
      date:        form.date,
      startMinutes,
      endMinutes,
      coordinator: sessionName,
      companyName: sessionCompany,
      ownerEmail:  user?.email ?? '',
    })
    onClose()
    setForm({ meetingName: '', room: '', date: '', time: '', duration: '' })
  }

  function toHourLabel(h) {
    if (h === 0)  return '12:00 AM'
    if (h === 12) return '12:00 PM'
    return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`
  }

  const inputClass = "w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-2xl text-sm text-black placeholder-[#999] outline-none focus:border-black focus:bg-white transition-colors"
  const labelClass = "flex items-center gap-1.5 text-xs font-semibold text-black uppercase tracking-wide"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E5E5]">
          <h2 className="text-base font-bold text-black">Schedule Meeting</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F9F9F9] transition-colors">
            <X size={16} className="text-[#666]" />
          </button>
        </div>

        {/* Form */}
        <form id="schedule-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Meeting Name */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}><Type size={11} /> Meeting Name</label>
            <input type="text" placeholder="e.g. Q3 Strategy Review" value={form.meetingName}
              onChange={set('meetingName')} required className={inputClass} />
          </div>


          {/* Meeting Room */}
          <div className="flex flex-col gap-1.5" ref={roomRef}>
            <label className={labelClass}><DoorOpen size={11} /> Meeting Room</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoomOpen(v => !v)}
                className={`${inputClass} cursor-pointer flex items-center justify-between text-left ${!form.room ? 'text-[#999]' : 'text-black'}`}
              >
                <span>{form.room ? `${form.room} · ${rooms.find(r => r.name === form.room)?.capacity ?? ''} seats` : 'Select room'}</span>
                <ChevronDown size={14} className={`flex-shrink-0 text-[#999] transition-transform duration-150 ${roomOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* hidden input for form validation */}
              <input type="text" required value={form.room} onChange={() => {}} className="sr-only" tabIndex={-1} />
              {roomOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E5E5E5] rounded-2xl shadow-lg z-[200] overflow-hidden">
                  {rooms.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[#AAA]">No rooms available</div>
                  ) : (
                    rooms.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, room: r.name })); setRoomOpen(false) }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F9F9F9] transition-colors
                          ${form.room === r.name ? 'bg-[#F5F5F5]' : ''}`}
                      >
                        <span className={`text-sm font-semibold ${form.room === r.name ? 'text-black' : 'text-[#333]'}`}>{r.name}</span>
                        <span className="flex items-center gap-1 text-xs text-[#999] font-medium">
                          <Users size={11} /> {r.capacity} seats
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}><CalendarDays size={11} /> Date</label>
              <DatePicker value={form.date} onChange={set('date')} required minDate={todayStr()} maxDate={maxDateStr()} offDays={offDays} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}><Clock size={11} /> Time</label>
              <TimePicker value={form.time} onChange={set('time')} required minHour={effectiveMinHour} maxHour={workEndHour} />
            </div>
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-1.5" ref={durationRef}>
            <label className={labelClass}><Timer size={11} /> Duration</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDurationOpen(v => !v)}
                className={`${inputClass} cursor-pointer flex items-center justify-between text-left ${!form.duration ? 'text-[#999]' : 'text-black'}`}
              >
                <span>{form.duration || 'Select duration'}</span>
                <ChevronDown size={14} className={`flex-shrink-0 text-[#999] transition-transform duration-150 ${durationOpen ? 'rotate-180' : ''}`} />
              </button>
              <input type="text" required value={form.duration} onChange={() => {}} className="sr-only" tabIndex={-1} />
              {durationOpen && (
                <div className="absolute left-0 right-0 bottom-full mb-1.5 bg-white border border-[#E5E5E5] rounded-2xl shadow-lg z-[200] overflow-hidden">
                  {allowedDurations.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setForm(f => ({ ...f, duration: d })); setDurationOpen(false) }}
                      className={`w-full px-4 py-3 text-left text-sm font-semibold hover:bg-[#F9F9F9] transition-colors
                        ${form.duration === d ? 'bg-[#F5F5F5] text-black' : 'text-[#333]'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Past time warning */}
          {isPastTime && !conflict && (
            <div className="flex items-center gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
              <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs font-bold text-amber-700">That time has already passed. Please choose a future time.</p>
            </div>
          )}

          {/* Conflict warning */}
          {conflict && (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-2xl">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-red-700">This room is already booked for the selected time</p>
                {conflict.title && (
                  <p className="text-[11px] font-semibold text-red-600 mt-0.5 truncate">&ldquo;{conflict.title}&rdquo;</p>
                )}
                <p className="text-[11px] text-red-500 mt-1">
                  <span className="font-semibold">{conflict.room}</span> is locked from{' '}
                  <span className="font-semibold">{formatMinutes(conflict.startMinutes)}</span> to{' '}
                  <span className="font-semibold">{formatMinutes(conflict.endMinutes)}</span>. Choose a different room or time slot.
                </p>
              </div>
            </div>
          )}

          {/* Booking rule violation */}
          {bookingError && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-700">{bookingError}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E5E5] bg-[#F9F9F9] rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-black border border-[#E5E5E5] rounded-2xl hover:bg-white transition-colors">
            Cancel
          </button>
          <button type="submit" form="schedule-form" disabled={!!conflict || isPastTime}
            className={`px-5 py-2.5 text-sm font-semibold rounded-2xl transition-colors
              ${conflict || isPastTime
                ? 'bg-[#E5E5E5] text-[#999] cursor-not-allowed'
                : 'bg-black text-white hover:bg-neutral-800'}`}>
            Schedule Meeting
          </button>
        </div>
      </div>
    </div>
  )
}
