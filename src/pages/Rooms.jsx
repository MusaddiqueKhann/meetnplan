import { useState } from 'react'
import { Users, Monitor, PenLine, Video, Wifi, Coffee, ArrowRight, Search, X, Plus } from 'lucide-react'
import Card from '../components/ui/Card'
import AddRoomModal from '../components/modals/AddRoomModal'

const featureIcon = (f) => {
  if (f.includes('Display') || f.includes('Projector')) return Monitor
  if (f.includes('Whiteboard')) return PenLine
  if (f.includes('VC') || f.includes('Video')) return Video
  if (f.includes('WiFi')) return Wifi
  if (f.includes('Coffee')) return Coffee
  return Monitor
}

function pad(n) { return String(n).padStart(2, '0') }
function toAmPm(totalMins) {
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(m)} ${period}`
}
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Rooms({ onOpenModal, rooms, onAddRoom, onRemoveRoom, bookings = [], onNavigate, user }) {
  const [search,  setSearch]  = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const isAdmin = user?.role === 'admin'

  const now        = new Date()
  const todayStr   = dateStr(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const isActive = (b) => !b.status || b.status === 'approved' || b.status === 'rescheduled'

  const getCurrentBooking = (roomName) =>
    bookings.find(b =>
      isActive(b) &&
      b.room === roomName &&
      b.date === todayStr &&
      nowMinutes >= b.startMinutes &&
      nowMinutes < b.endMinutes
    ) || null

  const getUpNext = (roomName) =>
    bookings
      .filter(b =>
        isActive(b) &&
        b.room === roomName &&
        (b.date > todayStr || (b.date === todayStr && b.startMinutes > nowMinutes))
      )
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startMinutes - b.startMinutes)[0] || null


  const filtered  = rooms.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
  const available = rooms.filter((r) => !getCurrentBooking(r.name)).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight">Meeting Rooms</h1>
          <p className="text-sm text-[#666] mt-1">{available} of {rooms.length} rooms available right now</p>
        </div>
        <button onClick={onOpenModal} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-2xl hover:bg-neutral-800 transition-colors">
          + Book Room
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-black tracking-tight">All Meeting Rooms</h2>
          <span className="px-2.5 py-0.5 bg-black text-white text-[11px] font-bold rounded-full">{filtered.length}</span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999]" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 bg-[#F9F9F9] border border-[#E5E5E5] rounded-2xl text-sm text-black placeholder-[#999] outline-none focus:border-black focus:bg-white transition-colors w-56"
          />
        </div>
      </div>

      {/* Room Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((room) => {
          const current  = getCurrentBooking(room.name)
          const occupied = !!current
          const upNext   = getUpNext(room.name)

          return (
            <Card key={room.id} className="overflow-hidden flex flex-col">

              {/* Banner */}
              <div className={`h-40 relative flex items-center justify-center ${room.image ? '' : `bg-gradient-to-br ${room.bg}`}`}>
                {room.image
                  ? <img src={room.image} alt={room.name} className="absolute inset-0 w-full h-full object-cover" />
                  : <span className="text-[80px] font-black text-black/5 select-none leading-none">{room.pattern}</span>
                }
                {isAdmin && (
                  <button
                    onClick={() => {
                      const hasBookings = bookings.some(b => b.room === room.name)
                      if (hasBookings && !window.confirm(`"${room.name}" has scheduled meetings. Remove it anyway?`)) return
                      onRemoveRoom(room.id)
                    }}
                    className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full bg-white/80 hover:bg-white border border-black/10 shadow-sm transition-all"
                  >
                    <X size={11} className="text-[#555]" />
                  </button>
                )}
                {occupied && (
                  <div className="absolute bottom-3 right-3">
                    <div className="bg-black/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      In Use
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-black">{room.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Users size={11} className="text-[#999]" />
                      <span className="text-xs text-[#666] font-medium">{room.capacity} People</span>
                    </div>
                  </div>
                  {occupied ? (
                    <span className="inline-flex items-center px-2.5 py-1 bg-black text-white text-[10px] font-bold rounded-full">Occupied</span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 border border-[#E5E5E5] text-black text-[10px] font-bold rounded-full">Available</span>
                  )}
                </div>

                {/* Current meeting */}
                {occupied && current && (
                  <div className="mb-3 px-3 py-2.5 bg-[#F9F9F9] rounded-xl border border-[#E5E5E5]">
                    <p className="text-xs font-semibold text-black truncate">{current.title}</p>
                    <p className="text-[10px] text-[#999] mt-0.5">
                      {current.coordinator || current.companyName || '—'}
                      {' · until '}
                      {toAmPm(current.endMinutes)}
                    </p>
                  </div>
                )}

                {/* Up Next */}
                {upNext && (
                  <div className="mb-3 px-3 py-2.5 bg-[#F9F9F9] rounded-xl border border-[#E5E5E5]">
                    <p className="text-[10px] font-bold text-[#999] uppercase tracking-wide mb-1">Up Next</p>
                    <p className="text-xs font-bold text-black truncate">{upNext.title}</p>
                    <p className="text-[10px] text-[#999] mt-0.5">
                      <span className="font-semibold text-black">{upNext.room}</span>
                      {' · '}
                      <span>{upNext.coordinator || upNext.companyName || '—'}</span>
                      {' · '}
                      <span className="font-semibold text-black">{toAmPm(upNext.startMinutes)} – {toAmPm(upNext.endMinutes)}</span>
                    </p>
                  </div>
                )}

                {/* Features */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {room.features.map((f) => {
                    const Icon = featureIcon(f)
                    return (
                      <span key={f} className="inline-flex items-center gap-1 px-2 py-1 bg-[#F9F9F9] border border-[#E5E5E5] rounded-lg text-[10px] font-semibold text-[#666]">
                        <Icon size={9} /> {f}
                      </span>
                    )
                  })}
                </div>

                {/* Action */}
                <div className="flex gap-2 mt-auto">
                  {!occupied ? (
                    <button
                      onClick={onOpenModal}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
                    >
                      Book Room <ArrowRight size={12} />
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigate?.('today')}
                      className="flex-1 py-2 text-xs font-semibold text-black border border-[#E5E5E5] rounded-xl hover:bg-[#F9F9F9] transition-colors"
                    >
                      View Schedule
                    </button>
                  )}
                </div>
              </div>

            </Card>
          )
        })}

        {/* Add Room card — admin only */}
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="border-2 border-dashed border-[#E5E5E5] rounded-2xl flex flex-col items-center justify-center gap-3 min-h-[200px] hover:border-black hover:bg-[#FAFAFA] transition-all group"
          >
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-[#CCCCCC] flex items-center justify-center group-hover:border-black transition-colors">
              <Plus size={18} className="text-[#CCCCCC] group-hover:text-black transition-colors" />
            </div>
            <span className="text-sm font-semibold text-[#AAAAAA] group-hover:text-black transition-colors">Add Room</span>
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-[#999] font-medium">No rooms match your filter.</p>
        </div>
      )}

      <AddRoomModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={onAddRoom}
      />
    </div>
  )
}
