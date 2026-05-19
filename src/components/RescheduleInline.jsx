import { useState, useRef, useEffect } from 'react'
import { RotateCcw, CalendarDays, Clock, DoorOpen, ChevronDown, AlertCircle, Loader2, Users } from 'lucide-react'
import DatePicker from './ui/DatePicker'
import TimePicker from './ui/TimePicker'

function toMinutes(time) {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RescheduleInline({ booking, bookings, rooms, settings, onReschedule, onCancel }) {
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
    <form onSubmit={handleSubmit} className="mt-2 bg-white border border-[#E5E5E5] rounded-2xl shadow-sm">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#F0F0F0] bg-[#FAFAFA] rounded-t-2xl flex items-center justify-between">
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
