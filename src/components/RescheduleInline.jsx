import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, CalendarDays, Clock, Timer, DoorOpen, ChevronDown, AlertCircle, Loader2, Users } from 'lucide-react'
import DatePicker from './ui/DatePicker'
import TimePicker from './ui/TimePicker'

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
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RescheduleInline({ booking, bookings, rooms, settings, onReschedule, onCancel }) {
  const workStartHour = settings.workStartHour ?? 8
  const workEndHour   = settings.workEndHour   ?? 20
  const offDays       = settings.offDays       ?? [5, 6]
  const maxDaysAhead  = settings.maxDaysAhead  ?? 30

  const bookingDurMins  = booking.endMinutes - booking.startMinutes
  const initialDuration = Object.entries(DURATION_MINUTES).find(([, v]) => v === bookingDurMins)?.[0] ?? '30 min'

  const [date,     setDate]     = useState(booking.date)
  const [time,     setTime]     = useState('')
  const [room,     setRoom]     = useState(booking.room)
  const [duration, setDuration] = useState(initialDuration)
  const [roomOpen, setRoomOpen] = useState(false)
  const [durOpen,  setDurOpen]  = useState(false)
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const roomRef    = useRef(null)
  const durRef     = useRef(null)
  const durMenuRef = useRef(null)
  const [durRect,  setDurRect] = useState(null)

  useEffect(() => {
    const h = (e) => {
      if (roomRef.current && !roomRef.current.contains(e.target)) setRoomOpen(false)
      if (
        durRef.current && !durRef.current.contains(e.target) &&
        !(durMenuRef.current && durMenuRef.current.contains(e.target))
      ) setDurOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function openDurDropdown() {
    if (durRef.current) setDurRect(durRef.current.getBoundingClientRect())
    setDurOpen(v => !v)
  }

  function maxDateStr() {
    const d = new Date()
    d.setDate(d.getDate() + maxDaysAhead)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const now              = new Date()
  const isSelectedToday  = date === todayStr()
  const dur              = DURATION_MINUTES[duration] || 30
  const effectiveMinHour = isSelectedToday ? Math.max(workStartHour, now.getHours()) : workStartHour
  const effectiveMaxHour = Math.floor((workEndHour * 60 - dur) / 60) + 1

  function validate() {
    if (!date || !time || !room || !duration) return 'Please fill in all fields.'
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
      b.status !== 'cancelled' &&
      b.status !== 'rejected' &&
      b.status !== 'pending_priority_approval' &&
      b.status !== 'priority_pending' &&
      startMins < b.endMinutes && endMins > b.startMinutes
    )
    if (conflict) return 'The selected time and date are already occupied.'
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

  const inputCls = 'w-full px-3.5 py-2.5 bg-white border border-[#EBEBEB] rounded-2xl text-[12px] text-black outline-none transition-all cursor-pointer flex items-center justify-between hover:border-[#D4D4D4]'
  const labelCls = 'flex items-center gap-1 text-[9px] font-bold text-[#C0C0C0] uppercase tracking-[0.12em] mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="mt-3 w-full rounded-3xl bg-white border border-[#EEEEEE] shadow-[0_8px_40px_-8px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.04)]">

      {/* Header */}
      <div className="px-4 pt-4 pb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-2xl bg-black flex items-center justify-center flex-shrink-0 shadow-sm">
            <RotateCcw size={13} className="text-white" />
          </div>
          <div>
            <span className="text-[14px] font-bold text-black tracking-tight block leading-tight">Reschedule</span>
            <span className="text-[11px] text-[#AAAAAA] font-medium">Pick a new date, time & duration</span>
          </div>
        </div>
        <span className="text-[11px] font-bold text-[#AAAAAA] bg-[#F5F5F5] px-3 py-1.5 rounded-full">{duration}</span>
      </div>

      <div className="h-px bg-[#F2F2F2] mx-4" />

      <div className="p-4 flex flex-col gap-3">

        {/* Date + Time + Duration + Room row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className={labelCls}><CalendarDays size={8} /> Date</label>
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
            <label className={labelCls}><Clock size={8} /> Time</label>
            <TimePicker
              value={time}
              onChange={e => { setTime(e.target.value); setError('') }}
              required
              minHour={effectiveMinHour}
              maxHour={effectiveMaxHour}
            />
          </div>
          <div ref={durRef}>
            <label className={labelCls}><Timer size={8} /> Duration</label>
            <div className="relative">
              <button
                type="button"
                onClick={openDurDropdown}
                className={inputCls}
              >
                <span className="font-medium truncate text-[12px]">{duration}</span>
                <ChevronDown size={12} className={`flex-shrink-0 text-[#CCCCCC] transition-transform duration-200 ${durOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {durOpen && durRect && createPortal(
            <div
              ref={durMenuRef}
              style={{
                position: 'fixed',
                left: durRect.left,
                bottom: window.innerHeight - durRect.top + 6,
                width: durRect.width,
                zIndex: 9999,
              }}
              className="bg-white border border-[#EEEEEE] rounded-2xl shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.1)] overflow-hidden"
            >
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { setDuration(d); setDurOpen(false); setError('') }}
                  className={`w-full flex items-center px-3.5 py-2.5 text-left transition-colors ${duration === d ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]'}`}
                >
                  <span className={`text-[12px] font-semibold ${duration === d ? 'text-black' : 'text-[#444]'}`}>{d}</span>
                </button>
              ))}
            </div>,
            document.body
          )}
          <div ref={roomRef}>
            <label className={labelCls}><DoorOpen size={8} /> Room</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoomOpen(v => !v)}
                className={`${inputCls} ${!room ? 'text-[#C8C8C8]' : 'text-black'}`}
              >
                <span className="font-medium truncate text-[12px]">
                  {room ? room : 'Select'}
                </span>
                <ChevronDown size={12} className={`flex-shrink-0 text-[#CCCCCC] transition-transform duration-200 ${roomOpen ? 'rotate-180' : ''}`} />
              </button>
              <input type="text" required readOnly value={room} onChange={() => {}} className="sr-only" tabIndex={-1} />
              {roomOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#EEEEEE] rounded-2xl shadow-[0_8px_24px_-4px_rgba(0,0,0,0.1)] z-[200] overflow-hidden">
                  {rooms.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setRoom(r.name); setRoomOpen(false); setError('') }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors ${room === r.name ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]'}`}
                    >
                      <span className={`text-[12px] font-semibold ${room === r.name ? 'text-black' : 'text-[#444]'}`}>{r.name}</span>
                      <span className="flex items-center gap-1 text-[10px] text-[#BBBBBB] font-medium flex-shrink-0">
                        <Users size={9} /> {r.capacity}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-2xl">
            <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
            <p className="text-[11px] text-red-500 font-medium">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-black text-white text-[12px] font-bold rounded-2xl hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_2px_12px_rgba(0,0,0,0.18)] min-w-0"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            <span className="truncate">Reschedule</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="w-full sm:w-auto sm:flex-shrink-0 px-4 py-2.5 text-[12px] font-semibold text-[#BBBBBB] hover:text-black border border-[#EEEEEE] rounded-2xl hover:border-[#D4D4D4] transition-all disabled:opacity-40 text-center"
          >
            Cancel
          </button>
        </div>

      </div>
    </form>
  )
}
