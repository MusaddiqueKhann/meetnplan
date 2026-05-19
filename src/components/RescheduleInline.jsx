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

  const inputCls = 'w-full px-3.5 py-2.5 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl text-[13px] text-black outline-none focus:border-black focus:bg-white transition-colors cursor-pointer flex items-center justify-between hover:border-[#C8C8C8] hover:bg-white'
  const labelCls = 'flex items-center gap-1.5 text-[10px] font-extrabold text-[#888] uppercase tracking-[0.1em] mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)]">

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#F0F0F0] rounded-t-2xl bg-[#FAFAFA]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
            <RotateCcw size={11} className="text-white" />
          </div>
          <span className="text-[13px] font-bold text-black">Reschedule Meeting</span>
        </div>
        <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-100 px-2.5 py-1 rounded-full">{durLabel}</span>
      </div>

      <div className="p-4 flex flex-col gap-3.5">

        {/* Date + Time row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}><CalendarDays size={9} /> Date</label>
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
            <label className={labelCls}><Clock size={9} /> Time</label>
            <TimePicker
              value={time}
              onChange={e => { setTime(e.target.value); setError('') }}
              required
              minHour={effectiveMinHour}
              maxHour={effectiveMaxHour}
            />
          </div>
        </div>

        {/* Room */}
        <div ref={roomRef}>
          <label className={labelCls}><DoorOpen size={9} /> Room</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setRoomOpen(v => !v)}
              className={`${inputCls} ${!room ? 'text-[#BABABA]' : 'text-black'}`}
            >
              <span className="font-medium truncate">
                {room ? `${room} · ${rooms.find(r => r.name === room)?.capacity ?? ''} seats` : 'Select room'}
              </span>
              <ChevronDown size={13} className={`flex-shrink-0 text-[#BBBBBB] transition-transform duration-150 ${roomOpen ? 'rotate-180' : ''}`} />
            </button>
            <input type="text" required readOnly value={room} onChange={() => {}} className="sr-only" tabIndex={-1} />
            {roomOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E8E8E8] rounded-xl shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)] z-[200] overflow-hidden">
                {rooms.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRoom(r.name); setRoomOpen(false); setError('') }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors ${room === r.name ? 'bg-neutral-50' : 'hover:bg-neutral-50'}`}
                  >
                    <span className={`text-[13px] font-semibold ${room === r.name ? 'text-black' : 'text-[#333]'}`}>{r.name}</span>
                    <span className="flex items-center gap-1 text-[11px] text-[#AAA] font-medium flex-shrink-0">
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
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
            <p className="text-[12px] text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-black text-white text-[13px] font-semibold rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            Confirm Reschedule
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2.5 text-[13px] font-medium text-neutral-400 hover:text-black border border-[#E8E8E8] rounded-xl hover:border-neutral-300 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
        </div>

      </div>
    </form>
  )
}
