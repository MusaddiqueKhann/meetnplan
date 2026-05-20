import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDoc,
} from 'firebase/firestore'
import { db } from '../../firebase'
import DatePicker from '../../components/ui/DatePicker'
import {
  Users, Building2, CalendarDays, BarChart3, Settings2,
  ShieldCheck, ShieldOff, Trash2, Loader2, Plus, Edit2,
  Check, X, Search, ChevronDown, AlertTriangle, Upload, ImageOff,
  Briefcase, History, AlertCircle, Filter,
} from 'lucide-react'

function compressImage(file, maxW = 800, maxH = 600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img  = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width: w, height: h } = img
      const ratio = Math.min(maxW / w, maxH / h, 1)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Image compression failed'))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const TABS = [
  { id: 'users',           label: 'Users',    icon: Users      },
  { id: 'rooms',           label: 'Rooms',    icon: Building2  },
  { id: 'bookings',        label: 'Bookings', icon: CalendarDays },
  { id: 'client_meetings', label: 'Clients',  icon: Briefcase  },
  { id: 'analytics',       label: 'Analytics',icon: BarChart3  },
  { id: 'settings',        label: 'Settings', icon: Settings2  },
]

const FEATURES = ['Display', 'Projector', 'Whiteboard', 'VC System', 'WiFi', 'Coffee Station', 'Video Conferencing']
const BG_OPTIONS = [
  'from-slate-100 to-slate-200',
  'from-zinc-100 to-zinc-200',
  'from-neutral-100 to-neutral-200',
  'from-stone-100 to-stone-200',
  'from-blue-50 to-blue-100',
  'from-indigo-50 to-indigo-100',
  'from-purple-50 to-purple-100',
  'from-emerald-50 to-emerald-100',
]
const PATTERNS = ['◆', '▲', '●', '■', '✦', '❋', '◉']

const inputCls = 'w-full px-4 py-3 rounded-xl border border-neutral-200 text-base md:text-sm bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all placeholder:text-neutral-300'

function pad(n) { return String(n).padStart(2, '0') }
function hourLabel(h) {
  if (h === 0)  return '12:00 AM'
  if (h === 12) return '12:00 PM'
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`
}
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

// ── Users Tab ──────────────────────────────────────────────────────────────
function UsersTab({ currentUser, bookings, deleteBooking }) {
  const [users,   setUsers]   = useState([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState({})
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    })
  }, [])

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.company?.toLowerCase().includes(search.toLowerCase())
  )

  async function toggleRole(u) {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    setLoading(l => ({ ...l, [u.id]: true }))
    try {
      await updateDoc(doc(db, 'users', u.id), { role: newRole })
    } finally {
      setLoading(l => ({ ...l, [u.id]: false }))
    }
  }

  async function deleteUserProfile(u) {
    setLoading(l => ({ ...l, [u.id + '_del']: true }))
    try {
      const userBookings = bookings.filter(b => b.ownerEmail === u.email)
      await Promise.all(userBookings.map(b => deleteBooking(b.id)))
      await deleteDoc(doc(db, 'users', u.id))
    } finally {
      setLoading(l => ({ ...l, [u.id + '_del']: false }))
      setConfirm(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-black">Users</h2>
          <p className="text-sm text-neutral-400 mt-0.5">{users.length} registered accounts</p>
        </div>
        <div className="relative w-full sm:w-56">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" placeholder="Search users..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 w-full bg-neutral-50 border border-neutral-200 rounded-xl text-base md:text-sm text-black placeholder-neutral-300 outline-none focus:border-black focus:bg-white transition-colors" />
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">No users found</div>
        )}

        {/* ── Mobile cards (hidden md+) ── */}
        <div className="block md:hidden divide-y divide-neutral-100">
          {filtered.map(u => {
            const isSelf       = u.id === currentUser.uid
            const bookingCount = bookings.filter(b => b.ownerEmail === u.email).length
            return (
              <div key={u.id} className="p-4 bg-white">
                {/* Top row: avatar + name + actions */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[13px] font-bold text-white">{(u.name || 'U').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-black truncate leading-tight">{u.name}</p>
                    <p className="text-[12px] text-neutral-400 truncate mt-0.5">{u.email || u.id}</p>
                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                        ${u.role === 'admin' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                        {u.role || 'user'}
                      </span>
                      {u.company && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] text-neutral-600 bg-neutral-50 border border-neutral-200 font-medium">
                          {u.company}
                        </span>
                      )}
                      <span className="text-[11px] text-neutral-400">{bookingCount} booking{bookingCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {/* Action buttons — large touch targets */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={isSelf || loading[u.id]}
                      title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-neutral-100 active:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      {loading[u.id]
                        ? <Loader2 size={15} className="animate-spin text-neutral-400" />
                        : u.role === 'admin'
                          ? <ShieldOff size={15} className="text-neutral-500" />
                          : <ShieldCheck size={15} className="text-indigo-500" />
                      }
                    </button>
                    <button
                      onClick={() => setConfirm(u)}
                      disabled={isSelf || loading[u.id + '_del']}
                      title="Delete user"
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      {loading[u.id + '_del']
                        ? <Loader2 size={15} className="animate-spin text-red-400" />
                        : <Trash2 size={15} className="text-red-400" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Desktop table (hidden below md) ── */}
        <div className="hidden md:block overflow-x-auto">
          <div className="grid grid-cols-[1fr_160px_100px_80px] min-w-[480px] text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-5 py-3 border-b border-neutral-100 bg-neutral-50">
            <span>User</span>
            <span>Company</span>
            <span>Role</span>
            <span>Actions</span>
          </div>
          {filtered.map(u => {
            const isSelf       = u.id === currentUser.uid
            const bookingCount = bookings.filter(b => b.ownerEmail === u.email).length
            return (
              <div key={u.id} className="grid grid-cols-[1fr_160px_100px_80px] min-w-[480px] items-center px-5 py-3.5 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-white">{(u.name || 'U').charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-black truncate">{u.name}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{u.email || u.id}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-300 mt-1 ml-9">{bookingCount} booking{bookingCount !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <span className="text-[12px] text-neutral-600 font-medium truncate block">{u.company || '—'}</span>
                </div>
                <div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                    ${u.role === 'admin' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                    {u.role || 'user'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRole(u)}
                    disabled={isSelf || loading[u.id]}
                    title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    {loading[u.id]
                      ? <Loader2 size={13} className="animate-spin text-neutral-400" />
                      : u.role === 'admin'
                        ? <ShieldOff size={13} className="text-neutral-500" />
                        : <ShieldCheck size={13} className="text-indigo-500" />
                    }
                  </button>
                  <button
                    onClick={() => setConfirm(u)}
                    disabled={isSelf || loading[u.id + '_del']}
                    title="Delete user"
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    {loading[u.id + '_del']
                      ? <Loader2 size={13} className="animate-spin text-red-400" />
                      : <Trash2 size={13} className="text-red-400" />
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-neutral-200 shadow-2xl p-6 w-full sm:max-w-sm flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-black">Delete user?</p>
                <p className="text-[12px] text-neutral-400 mt-0.5">
                  This removes <span className="font-semibold text-neutral-600">{confirm.name}</span> and all their bookings.
                </p>
              </div>
            </div>
            <p className="text-[12px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Their Firebase Auth account still exists. Delete it manually from the Firebase Console if needed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => deleteUserProfile(confirm)} disabled={loading[confirm.id + '_del']}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-60">
                {loading[confirm.id + '_del'] ? <Loader2 size={13} className="animate-spin" /> : 'Delete'}
              </button>
              <button onClick={() => setConfirm(null)}
                className="flex-1 py-3 text-[13px] font-semibold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Rooms Tab ──────────────────────────────────────────────────────────────
function RoomsTab({ rooms, bookings, onAddRoom, onRemoveRoom, onUpdateRoom }) {
  const [showForm,      setShowForm]      = useState(false)
  const [editRoom,      setEditRoom]      = useState(null)
  const [formData,      setFormData]      = useState({ name: '', capacity: '', bg: BG_OPTIONS[0], pattern: PATTERNS[0], features: [], image: '' })
  const [imageFile,     setImageFile]     = useState(null)
  const [imagePreview,  setImagePreview]  = useState('')
  const [saving,        setSaving]        = useState(false)
  const [formError,     setFormError]     = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting,      setDeleting]      = useState(false)

  function openAdd() {
    setEditRoom(null)
    setFormData({ name: '', capacity: '', bg: BG_OPTIONS[0], pattern: PATTERNS[0], features: [], image: '' })
    setImageFile(null)
    setImagePreview('')
    setFormError('')
    setShowForm(true)
  }

  function openEdit(room) {
    setEditRoom(room)
    setFormData({ name: room.name, capacity: String(room.capacity), bg: room.bg || BG_OPTIONS[0], pattern: room.pattern || PATTERNS[0], features: room.features || [], image: room.image || '' })
    setImageFile(null)
    setImagePreview('')
    setFormError('')
    setShowForm(true)
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file)
      const dataUrl    = await blobToBase64(compressed)
      setImageFile(dataUrl)
      setImagePreview(dataUrl)
      setFormData(d => ({ ...d, image: '' }))
    } catch (err) {
      setFormError(`Image error: ${err.message}`)
    }
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview('')
    setFormData(d => ({ ...d, image: '' }))
  }

  function toggleFeature(f) {
    setFormData(d => ({
      ...d,
      features: d.features.includes(f) ? d.features.filter(x => x !== f) : [...d.features, f],
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setFormError('')
    if (!formData.name.trim()) return setFormError('Room name is required.')
    const cap = parseInt(formData.capacity)
    if (!cap || cap < 1)       return setFormError('Please enter a valid capacity.')
    setSaving(true)
    try {
      let imageUrl = imageFile || formData.image || null
      const data = {
        name:     formData.name.trim(),
        capacity: cap,
        bg:       formData.bg,
        pattern:  formData.pattern,
        features: formData.features,
        ...(imageUrl ? { image: imageUrl } : { image: null }),
      }
      if (editRoom) {
        await onUpdateRoom(editRoom.id, data)
      } else {
        await onAddRoom({ id: '', ...data })
      }
      setShowForm(false)
    } catch (err) {
      setFormError(`Failed to save: ${err.code || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(room) {
    setConfirmDelete(room)
  }

  async function doDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await onRemoveRoom(confirmDelete.id)
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-black">Rooms</h2>
          <p className="text-sm text-neutral-400 mt-0.5">{rooms.length} meeting rooms</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-[13px] font-semibold rounded-xl hover:bg-neutral-800 active:bg-neutral-700 transition-colors">
          <Plus size={14} /> Add Room
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map(room => {
          const activeBookings = bookings.filter(b => b.room === room.name).length
          return (
            <div key={room.id} className="group bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
              {/* Image / Gradient area */}
              <div className="relative h-44 overflow-hidden">
                {room.image
                  ? <img src={room.image} alt={room.name} className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-300" />
                  : <div className={`w-full h-full bg-gradient-to-br ${room.bg} flex items-center justify-center`}>
                      <span className="text-7xl font-black text-black/[0.07]">{room.pattern}</span>
                    </div>
                }
                {/* Capacity badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                  <span className="text-[11px] font-semibold text-white">{room.capacity} seats</span>
                </div>
                {/* Action buttons — always visible on mobile, hover-reveal on desktop */}
                <div className="absolute top-3 right-3 flex gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                  <button onClick={() => openEdit(room)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm hover:bg-white shadow-sm transition-colors">
                    <Edit2 size={13} className="text-neutral-600" />
                  </button>
                  <button onClick={() => handleDelete(room)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm hover:bg-red-50 shadow-sm transition-colors">
                    <Trash2 size={13} className="text-red-500" />
                  </button>
                </div>
              </div>

              {/* Info area */}
              <div className="p-4 flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-bold text-black leading-tight">{room.name}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {activeBookings > 0
                        ? <span className="text-indigo-500 font-medium">{activeBookings} active booking{activeBookings !== 1 ? 's' : ''}</span>
                        : 'No upcoming bookings'}
                    </p>
                  </div>
                </div>
                {room.features?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {room.features.map(f => (
                      <span key={f} className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] font-medium rounded-full">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Delete room confirm — bottom sheet on mobile */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-neutral-200 shadow-2xl p-6 w-full sm:max-w-sm flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-black">Delete room?</p>
                <p className="text-[12px] text-neutral-400 mt-0.5">
                  <span className="font-semibold text-neutral-700">"{confirmDelete.name}"</span> will be permanently removed.
                </p>
              </div>
            </div>
            {(() => {
              const count = bookings.filter(b => b.room === confirmDelete.name).length
              return count > 0 ? (
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-700 font-medium">
                    This room has <span className="font-bold">{count} active booking{count !== 1 ? 's' : ''}</span>. Those bookings will remain and must be deleted separately.
                  </p>
                </div>
              ) : null
            })()}
            <div className="flex gap-3">
              <button onClick={doDelete} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-60">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> Delete Room</>}
              </button>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="flex-1 py-3 text-[13px] font-semibold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-60">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Room form — bottom sheet on mobile */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-neutral-200 shadow-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto">
            {/* Drag handle for mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-neutral-200 rounded-full" />
            </div>
            <div className="px-6 pb-6 pt-3 sm:pt-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-bold text-black">{editRoom ? 'Edit Room' : 'Add New Room'}</h3>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors">
                  <X size={15} className="text-neutral-500" />
                </button>
              </div>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Room Name</label>
                    <input type="text" placeholder="e.g. Boardroom A" value={formData.name}
                      onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} className={inputCls} required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Capacity</label>
                    <input type="number" placeholder="10" min="1" max="200" value={formData.capacity}
                      onChange={e => setFormData(d => ({ ...d, capacity: e.target.value }))} className={inputCls} required />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Background Colour</label>
                  <div className="grid grid-cols-4 gap-2">
                    {BG_OPTIONS.map(bg => (
                      <button key={bg} type="button" onClick={() => setFormData(d => ({ ...d, bg }))}
                        className={`h-9 rounded-lg bg-gradient-to-br ${bg} border-2 transition-all ${formData.bg === bg ? 'border-black scale-105' : 'border-transparent'}`} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Pattern</label>
                  <div className="flex gap-2 flex-wrap">
                    {PATTERNS.map(p => (
                      <button key={p} type="button" onClick={() => setFormData(d => ({ ...d, pattern: p }))}
                        className={`w-10 h-10 rounded-xl text-lg border-2 transition-all ${formData.pattern === p ? 'border-black bg-neutral-100' : 'border-neutral-200 hover:border-neutral-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image upload */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Room Image <span className="normal-case font-normal text-neutral-300">(optional — overrides gradient)</span></label>
                  {(imagePreview || formData.image) ? (
                    <div className="relative w-full h-28 rounded-xl overflow-hidden border border-neutral-200">
                      <img src={imagePreview || formData.image} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-2">
                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-[11px] font-semibold text-black cursor-pointer hover:bg-neutral-100 transition-colors">
                          <Upload size={11} /> Change
                          <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                        </label>
                        <button type="button" onClick={clearImage}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors">
                          <ImageOff size={11} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 h-24 border-2 border-dashed border-neutral-200 rounded-xl cursor-pointer hover:border-neutral-400 hover:bg-neutral-50 transition-all">
                      <Upload size={18} className="text-neutral-300" />
                      <span className="text-[11px] text-neutral-400 font-medium">Click to upload a room photo</span>
                      <span className="text-[10px] text-neutral-300">JPG, PNG, WEBP</span>
                      <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                    </label>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Features</label>
                  <div className="flex flex-wrap gap-2">
                    {FEATURES.map(f => (
                      <button key={f} type="button" onClick={() => toggleFeature(f)}
                        className={`px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all ${
                          formData.features.includes(f) ? 'bg-black text-white border-black' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                        }`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {formError && <p className="text-xs text-red-500">{formError}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-white bg-black rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-60">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <><Check size={14} /> {editRoom ? 'Save Changes' : 'Add Room'}</>}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-3 text-[13px] font-semibold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bookings Tab ───────────────────────────────────────────────────────────
function BookingsTab({ bookings, rooms, deleteBooking }) {
  const [search,     setSearch]     = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [roomOpen,   setRoomOpen]   = useState(false)

  const sorted = [...bookings].sort((a, b) => a.date !== b.date ? b.date.localeCompare(a.date) : b.startMinutes - a.startMinutes)

  const filtered = sorted.filter(b => {
    const matchRoom = !filterRoom || b.room === filterRoom
    const matchSearch = !search ||
      b.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.ownerEmail?.toLowerCase().includes(search.toLowerCase()) ||
      b.coordinator?.toLowerCase().includes(search.toLowerCase()) ||
      b.companyName?.toLowerCase().includes(search.toLowerCase())
    return matchRoom && matchSearch
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Header + filters */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold text-black">Bookings</h2>
          <p className="text-sm text-neutral-400 mt-0.5">{bookings.length} total · {filtered.length} shown</p>
        </div>
        {/* Filter row — stacks on mobile */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input type="text" placeholder="Search meetings, emails, companies..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-full bg-white border border-neutral-200 rounded-xl text-base md:text-sm text-black placeholder-neutral-300 outline-none focus:border-black transition-colors" />
          </div>
          {/* Room filter */}
          <div className="relative">
            <button onClick={() => setRoomOpen(v => !v)}
              className="flex items-center justify-between gap-2 w-full sm:w-auto px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-[13px] font-medium text-neutral-600 hover:border-neutral-400 transition-colors">
              <span>{filterRoom || 'All Rooms'}</span>
              <ChevronDown size={13} className={`transition-transform flex-shrink-0 ${roomOpen ? 'rotate-180' : ''}`} />
            </button>
            {roomOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-[160px] w-full sm:w-auto">
                {[{ name: '' }, ...rooms].map(r => (
                  <button key={r.name || '__all'} onClick={() => { setFilterRoom(r.name); setRoomOpen(false) }}
                    className={`w-full px-4 py-3 text-left text-[13px] font-medium hover:bg-neutral-50 transition-colors ${filterRoom === r.name ? 'text-black font-semibold' : 'text-neutral-600'}`}>
                    {r.name || 'All Rooms'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">No bookings found</div>
        )}

        {/* ── Mobile cards (hidden md+) ── */}
        <div className="block md:hidden divide-y divide-neutral-100">
          {filtered.map(b => (
            <div key={b.id} className="p-4 bg-white">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-black truncate leading-tight">{b.title || b.meetingName}</p>
                  <p className="text-[12px] text-neutral-400 truncate mt-0.5">{b.ownerEmail}</p>
                  {(b.companyName || b.coordinator) && (
                    <p className="text-[11px] text-neutral-400 truncate">{b.companyName || b.coordinator}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex px-2 py-0.5 rounded-lg bg-neutral-100 text-[11px] font-medium text-neutral-600">{b.room}</span>
                    <span className="text-[11px] text-neutral-500">{fmtDate(b.date)}</span>
                    <span className="text-[11px] text-neutral-500">{minsToAmPm(b.startMinutes)} – {minsToAmPm(b.endMinutes)}</span>
                  </div>
                </div>
                <button
                  onClick={() => { if (window.confirm('Cancel this booking?')) deleteBooking(b.id) }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors flex-shrink-0 mt-0.5">
                  <Trash2 size={15} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop table (hidden below md) ── */}
        <div className="hidden md:block overflow-x-auto">
          <div className="grid grid-cols-[1fr_140px_160px_48px] min-w-[500px] text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-5 py-3 border-b border-neutral-100 bg-neutral-50">
            <span>Meeting</span>
            <span>Room</span>
            <span>Date & Time</span>
            <span>Del</span>
          </div>
          {filtered.map(b => (
            <div key={b.id} className="grid grid-cols-[1fr_140px_160px_48px] min-w-[500px] items-center px-5 py-3.5 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
              <div className="min-w-0 pr-4">
                <p className="text-[13px] font-semibold text-black truncate">{b.title || b.meetingName}</p>
                <p className="text-[11px] text-neutral-400 truncate">{b.ownerEmail} · {b.companyName || b.coordinator || '—'}</p>
              </div>
              <div className="pr-4">
                <span className="text-[12px] font-medium text-neutral-600 truncate block">{b.room}</span>
              </div>
              <div>
                <p className="text-[12px] font-medium text-neutral-600">{fmtDate(b.date)}</p>
                <p className="text-[11px] text-neutral-400">{minsToAmPm(b.startMinutes)} – {minsToAmPm(b.endMinutes)}</p>
              </div>
              <div>
                <button onClick={() => { if (window.confirm('Cancel this booking?')) deleteBooking(b.id) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Analytics Tab ──────────────────────────────────────────────────────────
function AnalyticsTab({ bookings, rooms }) {
  const now      = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const thisWeek  = bookings.filter(b => b.date <= todayStr && b.date >= weekStart(now))
  const totalMins = bookings.reduce((s, b) => s + ((b.endMinutes || 0) - (b.startMinutes || 0)), 0)

  function weekStart(d) {
    const dow = d.getDay()
    const sun = new Date(d); sun.setDate(d.getDate() - dow)
    return `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`
  }

  // Bookings per room
  const byRoom = rooms.map(r => ({
    name:  r.name,
    count: bookings.filter(b => b.room === r.name).length,
  })).sort((a, b) => b.count - a.count)
  const maxRoom = Math.max(...byRoom.map(x => x.count), 1)

  // Bookings per company
  const companyCounts = {}
  bookings.forEach(b => {
    const c = b.companyName || 'Unknown'
    companyCounts[c] = (companyCounts[c] || 0) + 1
  })
  const byCompany = Object.entries(companyCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  const maxCompany = Math.max(...byCompany.map(x => x.count), 1)

  // Peak hours
  const hourCounts = Array(24).fill(0)
  bookings.forEach(b => {
    if (b.startMinutes != null) hourCounts[Math.floor(b.startMinutes / 60)]++
  })
  const peakHours = hourCounts.map((count, h) => ({ h, count })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 5)
  const maxHour = Math.max(...peakHours.map(x => x.count), 1)
  function hr(h) { const p = h >= 12 ? 'PM' : 'AM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:00 ${p}` }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-black">Analytics</h2>
        <p className="text-sm text-neutral-400 mt-0.5">Usage overview across all rooms and companies</p>
      </div>

      {/* KPI cards — 1 col on xs, 2 col on sm, 4 col on md+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Bookings', value: bookings.length },
          { label: 'This Week',      value: thisWeek.length },
          { label: 'Total Hours',    value: Math.round(totalMins / 60) + 'h' },
          { label: 'Rooms Active',   value: rooms.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-neutral-200 rounded-2xl p-4 min-w-0">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider leading-tight">{label}</p>
            <p className="text-2xl font-black text-black mt-1.5 leading-none">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bookings by Room */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <p className="text-[12px] font-bold text-black mb-4">Bookings by Room</p>
          {byRoom.length === 0 && <p className="text-sm text-neutral-300">No data yet</p>}
          <div className="flex flex-col gap-3">
            {byRoom.map(({ name, count }) => (
              <div key={name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-neutral-700 font-medium truncate">{name}</span>
                  <span className="text-[12px] font-bold text-black flex-shrink-0">{count}</span>
                </div>
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-black rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxRoom) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings by Company */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <p className="text-[12px] font-bold text-black mb-4">Bookings by Company</p>
          {byCompany.length === 0 && <p className="text-sm text-neutral-300">No data yet</p>}
          <div className="flex flex-col gap-3">
            {byCompany.map(({ name, count }) => (
              <div key={name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-neutral-700 font-medium truncate">{name}</span>
                  <span className="text-[12px] font-bold text-black flex-shrink-0">{count}</span>
                </div>
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxCompany) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5">
          <p className="text-[12px] font-bold text-black mb-4">Peak Booking Hours</p>
          {peakHours.length === 0 && <p className="text-sm text-neutral-300">No data yet</p>}
          <div className="flex flex-col gap-3">
            {peakHours.map(({ h, count }) => (
              <div key={h} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-neutral-700 font-medium">{hr(h)}</span>
                  <span className="text-[12px] font-bold text-black flex-shrink-0">{count}</span>
                </div>
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(count / maxHour) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Client Meetings Tab ────────────────────────────────────────────────────
function ClientMeetingsTab({ bookings, meetingHistory = [], adminOverrideApprove }) {
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [filterRoom,    setFilterRoom]    = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [filterDate,    setFilterDate]    = useState('')
  const [search,        setSearch]        = useState('')
  const [now,           setNow]           = useState(Date.now())
  const [overriding,    setOverriding]    = useState({})

  // Refresh "now" every 30 s so countdown labels stay current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

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

  const STATUS_CONFIG = {
    approved:                  { label: 'Approved',          cls: 'bg-green-100 text-green-700'      },
    pending_priority_approval: { label: 'Awaiting Approval', cls: 'bg-amber-100 text-amber-700'      },
    // legacy statuses
    priority_pending:          { label: 'Priority Pending',  cls: 'bg-amber-100 text-amber-700'      },
    waiting_for_action:        { label: 'Action Needed',     cls: 'bg-red-100 text-red-600'          },
    rescheduled:               { label: 'Rescheduled',       cls: 'bg-blue-100 text-blue-700'        },
    cancelled:                 { label: 'Cancelled',         cls: 'bg-neutral-100 text-neutral-500'  },
    rejected:                  { label: 'Rejected',          cls: 'bg-red-100 text-red-600'          },
  }

  const HISTORY_ACTIONS = {
    created:                { label: 'Created',          cls: 'bg-green-100 text-green-700'   },
    priority_created:       { label: 'Priority Created', cls: 'bg-amber-100 text-amber-700'   },
    approved:               { label: 'Approved',         cls: 'bg-green-100 text-green-700'   },
    deleted_with_reason:    { label: 'Deleted',          cls: 'bg-red-100 text-red-600'       },
    rescheduled:            { label: 'Rescheduled',      cls: 'bg-blue-100 text-blue-700'     },
    admin_override_deleted: { label: 'Admin Override',   cls: 'bg-red-900/10 text-red-800'    },
  }

  const allRooms     = [...new Set(bookings.map(b => b.room))].filter(Boolean).sort()
  const allCompanies = [...new Set(bookings.map(b => b.clientName || b.companyName))].filter(Boolean).sort()

  const clientMeetings = bookings
    .filter(b => b.meetingType === 'client')
    .filter(b => filterStatus  === 'all' || b.status === filterStatus)
    .filter(b => filterRoom    === 'all' || b.room === filterRoom)
    .filter(b => filterCompany === 'all' || (b.clientName || b.companyName) === filterCompany)
    .filter(b => !filterDate   || b.date === filterDate)
    .filter(b => !search       ||
      b.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.ownerEmail?.toLowerCase().includes(search.toLowerCase()) ||
      b.coordinator?.toLowerCase().includes(search.toLowerCase()) ||
      b.clientName?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.date !== b.date ? b.date.localeCompare(a.date) : b.startMinutes - a.startMinutes)

  // KPIs
  const total         = bookings.filter(b => b.meetingType === 'client').length
  const pending       = bookings.filter(b => b.meetingType === 'client' && (b.status === 'pending_priority_approval' || b.status === 'priority_pending')).length
  const approved      = bookings.filter(b => b.meetingType === 'client' && b.status === 'approved').length
  const rescheduled   = bookings.filter(b => b.meetingType === 'client' && b.status === 'rescheduled').length
  const waitingAction = bookings.filter(b => b.status === 'waiting_for_action').length

  // Client meeting history
  const clientHistory = meetingHistory
    .filter(h => h.meetingType === 'client' || h.action === 'priority_created' || h.action === 'approved')
    .slice(0, 40)

  const hasActiveFilters = filterStatus !== 'all' || filterRoom !== 'all' || filterCompany !== 'all' || filterDate || search

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-black">Client Meetings</h2>
        <p className="text-sm text-neutral-400 mt-0.5">Priority management and approval tracking</p>
      </div>

      {/* KPIs — 2 col on mobile, 5 col on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Client',     value: total,         cls: 'text-amber-600'  },
          { label: 'Approved',         value: approved,      cls: 'text-green-600'  },
          { label: 'Priority Pending', value: pending,       cls: 'text-amber-600'  },
          { label: 'Action Needed',    value: waitingAction, cls: 'text-red-500'    },
          { label: 'Rescheduled',      value: rescheduled,   cls: 'text-blue-600'   },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white border border-neutral-200 rounded-2xl p-4 min-w-0">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider leading-tight">{label}</p>
            <p className={`text-2xl font-black mt-1.5 leading-none ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters — fully stacked on mobile */}
      <div className="flex flex-col gap-2">
        {/* Search full width */}
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" placeholder="Search meetings, coordinators, clients..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 w-full bg-white border border-neutral-200 rounded-xl text-base md:text-sm text-black placeholder-neutral-300 outline-none focus:border-black transition-colors" />
        </div>
        {/* Select filters — 2-col grid on mobile, inline on sm+ */}
        <div className="grid grid-cols-2 sm:flex gap-2 flex-wrap">
          {[
            { value: filterStatus,  onChange: setFilterStatus,  opts: [
              { v: 'all', l: 'All Statuses' },
              { v: 'approved',                  l: 'Approved'          },
              { v: 'pending_priority_approval', l: 'Awaiting Approval'  },
              { v: 'rejected',                  l: 'Rejected'           },
              { v: 'priority_pending',          l: 'Priority Pending'   },
              { v: 'waiting_for_action',        l: 'Action Needed'      },
              { v: 'rescheduled',               l: 'Rescheduled'        },
              { v: 'cancelled',                 l: 'Cancelled'          },
            ]},
            { value: filterRoom, onChange: setFilterRoom, opts: [{ v: 'all', l: 'All Rooms' }, ...allRooms.map(r => ({ v: r, l: r }))] },
            { value: filterCompany, onChange: setFilterCompany, opts: [{ v: 'all', l: 'All Clients' }, ...allCompanies.map(c => ({ v: c, l: c }))] },
          ].map(({ value, onChange, opts }, i) => (
            <select key={i} value={value} onChange={e => onChange(e.target.value)}
              className="w-full sm:w-auto px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-base md:text-sm text-black focus:outline-none focus:border-black transition-colors cursor-pointer">
              {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          ))}
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="col-span-2 sm:col-span-1 px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-base md:text-sm text-black focus:outline-none focus:border-black transition-colors" />
        </div>
        {hasActiveFilters && (
          <button onClick={() => { setFilterStatus('all'); setFilterRoom('all'); setFilterCompany('all'); setFilterDate(''); setSearch('') }}
            className="self-start px-3 py-2 text-[13px] font-semibold text-neutral-500 hover:text-black transition-colors border border-neutral-200 rounded-xl bg-white">
            Clear filters
          </button>
        )}
      </div>

      {/* Meetings list */}
      {clientMeetings.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl px-5 py-14 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <Briefcase size={20} className="text-neutral-300" />
          </div>
          <p className="text-[13px] font-semibold text-neutral-400">No client meetings found</p>
          <p className="text-[11px] text-neutral-300">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {clientMeetings.map(b => {
            const statusInfo = STATUS_CONFIG[b.status]

            const accentMap = {
              pending_priority_approval: 'border-l-amber-400   bg-amber-50/30',
              rejected:                  'border-l-red-300     bg-red-50/10',
              approved:                  'border-l-green-400   bg-white',
              rescheduled:               'border-l-blue-400    bg-blue-50/20',
              cancelled:                 'border-l-neutral-300 bg-neutral-50/60',
              priority_pending:          'border-l-amber-400   bg-amber-50/30',
              waiting_for_action:        'border-l-red-400     bg-red-50/20',
            }
            const dotMap = {
              pending_priority_approval: 'bg-amber-400',
              rejected:                  'bg-red-300',
              approved:                  'bg-green-400',
              rescheduled:               'bg-blue-400',
              cancelled:                 'bg-neutral-300',
              priority_pending:          'bg-amber-400',
              waiting_for_action:        'bg-red-400',
            }
            const accent = accentMap[b.status] ?? 'border-l-neutral-200 bg-white'
            const dot    = dotMap[b.status]    ?? 'bg-neutral-300'

            const conflictIds = (b.status === 'pending_priority_approval' || b.status === 'priority_pending')
              ? (b.conflictsWithIds ?? (b.conflictsWithId ? [b.conflictsWithId] : []))
              : []
            const conflictingBookings = conflictIds
              .map(id => bookings.find(x => x.id === id))
              .filter(x => x && x.status === 'approved')

            return (
              <div key={b.id} className="flex flex-col gap-0">
                {/* Main card */}
                <div
                  className={`border border-neutral-200 border-l-[3px] hover:shadow-sm transition-all ${accent} ${conflictingBookings.length > 0 ? 'rounded-t-2xl rounded-b-none border-b-0' : 'rounded-2xl'}`}
                >
                  {/* Mobile layout */}
                  <div className="block sm:hidden px-4 py-4">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
                          <span className="text-[12px] font-bold text-white">{(b.title || 'M').charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-black truncate leading-tight">{b.title}</p>
                          <p className="text-[11px] text-neutral-400 truncate">{b.ownerEmail}</p>
                        </div>
                      </div>
                      {statusInfo ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold flex-shrink-0 ${statusInfo.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                          {statusInfo.label}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400">{b.status ?? '—'}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.clientName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-200 rounded-lg">
                          <Building2 size={9} className="text-amber-600" />
                          <span className="text-[11px] font-bold text-amber-800">{b.clientName}</span>
                        </span>
                      )}
                      <span className="text-[11px] text-neutral-500 font-medium">{b.room}</span>
                      <span className="text-[11px] text-neutral-400">{fmtDate(b.date)}</span>
                      <span className="text-[11px] text-neutral-400">{minsToAmPm(b.startMinutes)}–{minsToAmPm(b.endMinutes)}</span>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[1fr_160px_180px_130px] items-center gap-2 px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-bold text-white">{(b.title || 'M').charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-black truncate leading-tight">{b.title}</p>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">{b.coordinator} · {b.companyName}</p>
                        <p className="text-[10px] text-neutral-300 truncate mt-0.5">{b.ownerEmail}</p>
                      </div>
                    </div>
                    <div>
                      {b.clientName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-200 rounded-xl">
                          <Building2 size={10} className="text-amber-600 flex-shrink-0" />
                          <span className="text-[12px] font-bold text-amber-800 truncate max-w-[100px]">{b.clientName}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-300">—</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[12px] font-semibold text-black truncate">{b.room}</p>
                      <p className="text-[11px] text-neutral-500">{fmtDate(b.date)}</p>
                      <p className="text-[11px] font-medium text-neutral-600">{minsToAmPm(b.startMinutes)} – {minsToAmPm(b.endMinutes)}</p>
                    </div>
                    <div>
                      {statusInfo ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold ${statusInfo.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                          {statusInfo.label}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400">{b.status ?? '—'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Override sub-panels — vertical on mobile ── */}
                {conflictingBookings.map((cb, cbIdx) => {
                  const overrideKey   = `${b.id}_${cb.id}`
                  const waitedMs      = b.createdAt?.toMillis ? now - b.createdAt.toMillis() : 0
                  const minsWaited    = Math.floor(waitedMs / 60_000)
                  const minsRemaining = Math.max(0, 5 - minsWaited)
                  const canOverride   = waitedMs >= 5 * 60_000
                  const isLast        = cbIdx === conflictingBookings.length - 1
                  return (
                    <div key={cb.id} className={`border border-neutral-200 border-l-[3px] ${isLast ? 'rounded-b-2xl' : ''} ${
                      canOverride
                        ? 'bg-red-50 border-l-red-500 border-t-red-100'
                        : 'bg-neutral-50 border-l-neutral-300 border-t-neutral-100'
                    }`}>
                      {/* Mobile: fully vertical stack */}
                      <div className="px-4 py-3 flex flex-col gap-3">
                        {/* Clash info row */}
                        <div className="flex items-start gap-2.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 animate-pulse ${canOverride ? 'bg-red-500' : 'bg-amber-400'}`} />
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-neutral-700 break-words">
                              Clashing with: &ldquo;{cb.title}&rdquo;
                            </p>
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              Owner: {cb.ownerEmail} · Waited {minsWaited}m
                            </p>
                          </div>
                        </div>

                        {canOverride ? (
                          <>
                            {/* Progress bar (full width) + label */}
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold text-red-700">No action for {minsWaited} min</p>
                                <p className="text-[10px] text-red-500">Owner unresponsive</p>
                              </div>
                              <div className="w-full h-1.5 bg-red-200 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full w-full" />
                              </div>
                            </div>
                            {/* Full-width override button */}
                            <button
                              disabled={!!overriding[overrideKey]}
                              onClick={async () => {
                                setOverriding(o => ({ ...o, [overrideKey]: true }))
                                try {
                                  await adminOverrideApprove?.(cb, b)
                                } finally {
                                  setOverriding(o => ({ ...o, [overrideKey]: false }))
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-[13px] font-bold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {overriding[overrideKey]
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />
                              }
                              Admin Override
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold text-neutral-600">Override available in {minsRemaining} min</p>
                              <p className="text-[10px] text-neutral-400">Waiting for owner</p>
                            </div>
                            <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (minsWaited / 5) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Approval History */}
      {clientHistory.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
            <History size={14} className="text-neutral-400" />
            <p className="text-[12px] font-bold text-black">Approval History</p>
            <span className="ml-auto text-[11px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">{clientHistory.length}</span>
          </div>
          <div className="divide-y divide-neutral-100 max-h-80 overflow-y-auto">
            {clientHistory.map(h => {
              const actionInfo = HISTORY_ACTIONS[h.action]
              return (
                <div key={h.id} className="px-5 py-3 flex items-start gap-4 hover:bg-neutral-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${actionInfo?.cls ?? 'bg-neutral-100 text-neutral-400'}`}>
                        {actionInfo?.label ?? h.action}
                      </span>
                      <span className="text-[12px] font-semibold text-black truncate">{h.bookingTitle}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {h.room} · {fmtDate(h.date)}
                      {h.clientName && <span className="text-amber-600 font-medium"> · Client: {h.clientName}</span>}
                    </p>
                    <p className="text-[11px] text-neutral-400">by {h.performedBy} ({h.performedByEmail})</p>
                    {h.reason && <p className="text-[11px] text-neutral-500 italic mt-0.5">Reason: {h.reason}</p>}
                    {h.newDate && (
                      <p className="text-[11px] text-blue-600 mt-0.5">
                        Rescheduled → {h.newRoom ?? h.room} · {fmtDate(h.newDate)}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 flex-shrink-0">{timeAgo(h.createdAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Settings Tab ───────────────────────────────────────────────────────────
function SettingsTab() {
  const [config, setConfig] = useState({
    maxBookingDurationMins: 180,
    maxDaysAhead:           30,
    workStartHour:          8,
    workEndHour:            20,
    offDays:                [5, 6],
    companies:              ['Wolfhead', 'CloudGate', 'CodeLtd'],
  })
  const [loading,          setLoading]          = useState(true)
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)
  const [saveError,        setSaveError]        = useState('')
  const [newCompany,       setNewCompany]       = useState('')
  const [newCompanyError,  setNewCompanyError]  = useState('')
  const [clearDate,        setClearDate]        = useState('')
  const [clearing,         setClearing]         = useState(false)
  const [clearConfirm,     setClearConfirm]     = useState(false)
  const [clearResult,      setClearResult]      = useState('')

  useEffect(() => {
    getDoc(doc(db, 'settings', 'config'))
      .then(snap => { if (snap.exists()) setConfig(c => ({ ...c, ...snap.data() })) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      await setDoc(doc(db, 'settings', 'config'), config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(`Failed to save: ${err.code || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const set = (key) => (e) => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))

  function addCompany() {
    const name = newCompany.trim()
    if (!name) return
    const existing = (config.companies ?? []).map(c => c.toLowerCase())
    if (existing.includes(name.toLowerCase())) {
      setNewCompanyError('Already in the list.')
      return
    }
    setConfig(c => ({ ...c, companies: [...(c.companies ?? []), name] }))
    setNewCompany('')
    setNewCompanyError('')
  }

  function removeCompany(name) {
    if ((config.companies ?? []).length <= 1) return
    setConfig(c => ({ ...c, companies: c.companies.filter(x => x !== name) }))
  }

  async function handleClear() {
    if (!clearDate) return
    setClearing(true)
    setClearResult('')
    try {
      const snap = await import('firebase/firestore').then(m =>
        m.getDocs(m.collection(db, 'bookings'))
      )
      const toDelete = snap.docs.filter(d => (d.data().date || '') <= clearDate)
      await Promise.all(toDelete.map(d => deleteDoc(doc(db, 'bookings', d.id))))
      setClearResult(`${toDelete.length} booking${toDelete.length !== 1 ? 's' : ''} deleted.`)
      setClearConfirm(false)
      setTimeout(() => setClearResult(''), 4000)
    } catch (err) {
      setClearResult(`Error: ${err.code || err.message}`)
    } finally {
      setClearing(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-neutral-300" /></div>

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-black">Settings</h2>
        <p className="text-sm text-neutral-400 mt-0.5">Global booking rules and workspace configuration</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {/* Booking Rules */}
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <p className="text-[12px] font-bold text-black">Booking Rules</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Max duration */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-black">Max booking duration</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">Maximum minutes per single booking</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="15" max="480" step="15" value={config.maxBookingDurationMins}
                  onChange={set('maxBookingDurationMins')}
                  className="w-24 px-3 py-2.5 rounded-xl border border-neutral-200 text-base md:text-sm text-right focus:outline-none focus:border-black transition-all" />
                <span className="text-[12px] text-neutral-400 flex-shrink-0">min</span>
              </div>
            </div>
            <div className="h-px bg-neutral-100" />
            {/* Max days ahead */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-black">Max days ahead</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">How far in advance users can book</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="365" value={config.maxDaysAhead}
                  onChange={set('maxDaysAhead')}
                  className="w-24 px-3 py-2.5 rounded-xl border border-neutral-200 text-base md:text-sm text-right focus:outline-none focus:border-black transition-all" />
                <span className="text-[12px] text-neutral-400 flex-shrink-0">days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <p className="text-[12px] font-bold text-black">Working Hours</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-4">
            {[
              { label: 'Start hour', desc: 'Earliest time users can book', key: 'workStartHour', hours: Array.from({ length: 13 }, (_, i) => i + 5) },
              { label: 'End hour',   desc: 'Latest time users can book',   key: 'workEndHour',   hours: Array.from({ length: 13 }, (_, i) => i + 12) },
            ].map(({ label, desc, key, hours }) => (
              <div key={key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-black">{label}</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">{desc}</p>
                </div>
                <select value={config[key]} onChange={set(key)}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-neutral-200 text-base md:text-sm text-black bg-white focus:outline-none focus:border-black transition-all cursor-pointer">
                  {hours.map(h => (
                    <option key={h} value={h}>{hourLabel(h)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Days Off */}
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <p className="text-[12px] font-bold text-black">Days Off</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Selected days will be hidden from the calendar and booking form</p>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-4 sm:flex gap-2 flex-wrap">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, i) => {
                const isOff = (config.offDays ?? []).includes(i)
                return (
                  <button key={i} type="button"
                    onClick={() => setConfig(c => ({
                      ...c,
                      offDays: isOff
                        ? (c.offDays ?? []).filter(d => d !== i)
                        : [...(c.offDays ?? []), i],
                    }))}
                    className={`py-2.5 rounded-xl text-[13px] font-semibold border transition-all
                      ${isOff
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-neutral-400 mt-3">
              <span className="font-semibold text-black">{(config.offDays ?? []).length}</span> day{(config.offDays ?? []).length !== 1 ? 's' : ''} off · {7 - (config.offDays ?? []).length} working day{7 - (config.offDays ?? []).length !== 1 ? 's' : ''} per week
            </p>
          </div>
        </div>

        {/* Companies */}
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <p className="text-[12px] font-bold text-black">Companies</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Shown in the signup and profile forms</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 min-h-[36px]">
              {(config.companies ?? []).map(company => (
                <span key={company} className="flex items-center gap-2 pl-3 pr-2 py-2 bg-neutral-100 border border-neutral-200 rounded-xl text-[13px] font-semibold text-black">
                  {company}
                  <button type="button" onClick={() => removeCompany(company)}
                    disabled={(config.companies ?? []).length <= 1}
                    title="Remove"
                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-neutral-300 active:bg-neutral-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New company name..."
                value={newCompany}
                onChange={e => { setNewCompany(e.target.value); setNewCompanyError('') }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCompany() } }}
                className={inputCls}
              />
              <button type="button" onClick={addCompany}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-black text-white text-[13px] font-semibold rounded-xl hover:bg-neutral-800 transition-colors flex-shrink-0">
                <Plus size={13} /> Add
              </button>
            </div>
            {newCompanyError && <p className="text-[11px] text-red-500">{newCompanyError}</p>}
            <p className="text-[11px] text-neutral-400">
              <span className="font-semibold text-black">{(config.companies ?? []).length}</span> {(config.companies ?? []).length === 1 ? 'company' : 'companies'} · must keep at least one
            </p>
          </div>
        </div>

        {/* Clear Booking Data */}
        <div className="bg-white border border-neutral-200 rounded-2xl">
          <div className="px-5 py-4 border-b border-neutral-100">
            <p className="text-[12px] font-bold text-black">Clear Booking Data</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Permanently delete all bookings up to and including the selected date</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="w-full sm:w-52">
                <DatePicker
                  value={clearDate}
                  onChange={e => { setClearDate(e.target.value); setClearResult('') }}
                />
              </div>
              <button
                type="button"
                disabled={!clearDate || clearing}
                onClick={() => setClearConfirm(true)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-3 bg-red-500 text-white text-[13px] font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {clearing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Clear Bookings
              </button>
            </div>
            {clearDate && (
              <p className="text-[11px] text-neutral-400">
                All bookings on or before <span className="font-semibold text-neutral-700">{new Date(clearDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span> will be permanently deleted.
              </p>
            )}
            {clearResult && (
              <p className={`text-[12px] font-semibold ${clearResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>{clearResult}</p>
            )}
          </div>
        </div>

        {/* Confirm clear modal — bottom sheet on mobile */}
        {clearConfirm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-neutral-200 shadow-2xl p-6 w-full sm:max-w-sm flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-black">Delete all bookings?</p>
                  <p className="text-[12px] text-neutral-400 mt-0.5">
                    All bookings up to <span className="font-semibold text-neutral-600">{new Date(clearDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span> will be permanently removed. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleClear} disabled={clearing}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-60">
                  {clearing ? <Loader2 size={13} className="animate-spin" /> : 'Yes, Delete'}
                </button>
                <button onClick={() => setClearConfirm(false)}
                  className="flex-1 py-3 text-[13px] font-semibold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-3 bg-black text-white text-[13px] font-semibold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-60 w-full sm:w-auto justify-center">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <><Check size={14} /> Save Settings</>}
          </button>
          {saved     && <span className="text-[12px] text-green-600 font-semibold">Settings saved!</span>}
          {saveError && <span className="text-[12px] text-red-500 font-semibold">{saveError}</span>}
        </div>
      </form>
    </div>
  )
}

// ── Admin Panel Root ───────────────────────────────────────────────────────
export default function AdminPanel({ rooms, bookings, onAddRoom, onRemoveRoom, onUpdateRoom, deleteBooking, user, meetingHistory = [], adminOverrideApprove }) {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">Admin Panel</h1>
          <p className="text-sm text-neutral-400">Manage users, rooms, bookings and workspace settings</p>
        </div>
      </div>

      {/* Desktop tab bar (hidden below md) */}
      <div className="hidden md:flex gap-0 border-b border-neutral-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`relative flex items-center gap-2 px-5 py-3 text-[13px] font-semibold whitespace-nowrap transition-all ${
              activeTab === id
                ? 'text-indigo-600'
                : 'text-neutral-400 hover:text-neutral-600'
            }`}>
            <Icon size={14} />
            {label}
            {activeTab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'users'           && <UsersTab          currentUser={user} bookings={bookings} deleteBooking={deleteBooking} />}
      {activeTab === 'rooms'           && <RoomsTab          rooms={rooms} bookings={bookings} onAddRoom={onAddRoom} onRemoveRoom={onRemoveRoom} onUpdateRoom={onUpdateRoom} />}
      {activeTab === 'bookings'        && <BookingsTab       bookings={bookings} rooms={rooms} deleteBooking={deleteBooking} />}
      {activeTab === 'client_meetings' && <ClientMeetingsTab bookings={bookings} meetingHistory={meetingHistory} adminOverrideApprove={adminOverrideApprove} />}
      {activeTab === 'analytics'       && <AnalyticsTab      bookings={bookings} rooms={rooms} />}
      {activeTab === 'settings'        && <SettingsTab />}

      {/* Mobile sticky bottom nav (hidden md+) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-neutral-200 safe-area-inset-bottom">
        <div className="grid grid-cols-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors ${
                activeTab === id
                  ? 'text-indigo-600'
                  : 'text-neutral-400 active:text-neutral-600'
              }`}
            >
              <Icon size={20} strokeWidth={activeTab === id ? 2.2 : 1.8} />
              <span className="text-[10px] font-semibold leading-tight">{label}</span>
              {activeTab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-b-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
