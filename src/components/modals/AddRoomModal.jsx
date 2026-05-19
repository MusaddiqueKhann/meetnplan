import { useState, useRef } from 'react'
import { X, Type, Users, CheckSquare, Square, ImagePlus, Trash2 } from 'lucide-react'

const FEATURE_OPTIONS = ['4K Display', 'Projector', 'Whiteboard', 'VC System', 'WiFi 6', 'Coffee Station', 'Stage']
const BG_OPTIONS      = [
  'from-neutral-200 to-neutral-100',
  'from-neutral-300 to-neutral-200',
  'from-neutral-100 to-gray-50',
  'from-gray-100 to-neutral-50',
]

export default function AddRoomModal({ isOpen, onClose, onAdd }) {
  const [form, setForm]       = useState({ name: '', floor: '', capacity: '' })
  const [features, setFeatures] = useState([])
  const [image, setImage]     = useState(null)
  const fileRef               = useRef(null)

  if (!isOpen) return null

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const toggleFeature = (f) =>
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      alert('Image must be under 8 MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 600
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        setImage(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onAdd({
      id: Date.now(),
      name: form.name.trim(),
      floor: form.floor || 'Floor 1',
      capacity: parseInt(form.capacity) || 10,
      status: 'Available',
      features: features.length ? features : ['4K Display'],
      bg: BG_OPTIONS[Math.floor(Math.random() * BG_OPTIONS.length)],
      pattern: form.name.trim()[0].toUpperCase(),
      image: image || null,
    })
    setForm({ name: '', floor: '', capacity: '' })
    setFeatures([])
    setImage(null)
    onClose()
  }

  const inputClass = "w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-2xl text-sm text-black placeholder-[#999] outline-none focus:border-black focus:bg-white transition-colors"
  const labelClass = "flex items-center gap-1.5 text-xs font-semibold text-black uppercase tracking-wide"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E5E5]">
          <h2 className="text-base font-bold text-black">Add Meeting Room</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F9F9F9] transition-colors">
            <X size={16} className="text-[#666]" />
          </button>
        </div>

        {/* Form */}
        <form id="add-room-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Image upload */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}><ImagePlus size={11} /> Room Image</label>
            {image ? (
              <div className="relative w-full h-36 rounded-2xl overflow-hidden">
                <img src={image} alt="Room" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImage(null); fileRef.current.value = '' }}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                >
                  <Trash2 size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current.click()}
                className="w-full h-36 border-2 border-dashed border-[#E5E5E5] rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-black hover:bg-[#FAFAFA] transition-all group"
              >
                <div className="w-9 h-9 rounded-full bg-[#F0F0F0] flex items-center justify-center group-hover:bg-[#E8E8E8] transition-colors">
                  <ImagePlus size={16} className="text-[#999] group-hover:text-black transition-colors" />
                </div>
                <span className="text-xs font-semibold text-[#AAAAAA] group-hover:text-black transition-colors">Click to upload image</span>
                <span className="text-[10px] text-[#CCCCCC]">PNG, JPG up to 10MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImage}
              className="hidden"
            />
          </div>

          {/* Room Name */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}><Type size={11} /> Room Name</label>
            <input
              type="text"
              placeholder="e.g. Golf"
              value={form.name}
              onChange={set('name')}
              required
              className={inputClass}
            />
          </div>

          {/* Capacity */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}><Users size={11} /> Capacity</label>
            <input
              type="number"
              placeholder="e.g. 12"
              min={1}
              value={form.capacity}
              onChange={set('capacity')}
              required
              className={inputClass}
            />
          </div>

          {/* Features */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}><CheckSquare size={11} /> Features</label>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_OPTIONS.map((f) => {
                const checked = features.includes(f)
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFeature(f)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all text-left
                      ${checked
                        ? 'bg-black text-white border-black'
                        : 'bg-[#F9F9F9] text-[#555] border-[#E5E5E5] hover:border-[#CCC]'}`}
                  >
                    {checked
                      ? <CheckSquare size={13} className="flex-shrink-0" />
                      : <Square size={13} className="flex-shrink-0 text-[#BBB]" />}
                    {f}
                  </button>
                )
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E5E5] bg-[#F9F9F9] rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-black border border-[#E5E5E5] rounded-2xl hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-room-form"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-black rounded-2xl hover:bg-neutral-800 transition-colors"
          >
            Add Room
          </button>
        </div>
      </div>
    </div>
  )
}
