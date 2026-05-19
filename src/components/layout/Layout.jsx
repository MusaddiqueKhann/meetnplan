import { useState, useRef, useEffect } from 'react'
import { Menu, Zap, Bell, CheckCheck } from 'lucide-react'
import Sidebar from './Sidebar'

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

function NotificationDropdown({ notifications, onMarkRead, onMarkAll, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const typeColor = {
    priority_request:    'bg-amber-500',
    meeting_approved:    'bg-green-500',
    meeting_cancelled:   'bg-red-500',
    meeting_rescheduled: 'bg-blue-500',
    admin_override:      'bg-red-700',
  }
  const typeLabel = {
    priority_request:    '⚡ Priority',
    meeting_approved:    '✓ Approved',
    meeting_cancelled:   '✕ Cancelled',
    meeting_rescheduled: '↗ Rescheduled',
    admin_override:      '⚠ Admin Action',
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E5E5E5] rounded-2xl shadow-xl z-[300] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0]">
        <span className="text-[12px] font-bold text-black">Notifications</span>
        {notifications.some(n => !n.read) && (
          <button
            onClick={onMarkAll}
            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-black transition-colors"
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell size={20} className="text-neutral-200 mx-auto mb-2" />
            <p className="text-[12px] text-neutral-400 font-medium">No notifications</p>
          </div>
        ) : (
          notifications.slice(0, 20).map(n => (
            <button
              key={n.id}
              onClick={() => onMarkRead(n.id)}
              className={`w-full text-left px-4 py-3 border-b border-[#F5F5F5] last:border-0 hover:bg-[#F9F9F9] transition-colors flex gap-3 items-start ${!n.read ? 'bg-blue-50/40' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 ${n.read ? 'bg-transparent' : 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white ${typeColor[n.type] ?? 'bg-neutral-400'}`}>
                    {typeLabel[n.type] ?? n.type}
                  </span>
                </div>
                <p className="text-[12px] font-medium text-black leading-snug">{n.message}</p>
                {n.room && (
                  <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{n.room} · {n.date}</p>
                )}
                <p className="text-[10px] text-neutral-400 mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default function Layout({
  currentPage, onNavigate, onOpenModal, rooms, bookings, checkedRooms, toggleRoom,
  onLogout, user, children, notifications = [], unreadCount = 0,
  markNotificationRead, markAllNotificationsRead,
}) {
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [notifOpen,    setNotifOpen]    = useState(false)

  const handleNavigate  = (page) => { onNavigate(page); setSidebarOpen(false) }
  const handleOpenModal = ()     => { onOpenModal();    setSidebarOpen(false) }

  return (
    <div className="flex w-full min-h-screen bg-[#F9F9F9]">

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenModal={handleOpenModal}
        rooms={rooms}
        bookings={bookings}
        checkedRooms={checkedRooms}
        toggleRoom={toggleRoom}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
        user={user}
        unreadCount={unreadCount}
        notifications={notifications}
        markNotificationRead={markNotificationRead}
        markAllNotificationsRead={markAllNotificationsRead}
        onNavigateProfile={() => handleNavigate('profile')}
      />

      <main className="flex-1 lg:ml-[260px] min-h-screen flex flex-col">

        {/* Mobile / tablet top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#EBEBEB] sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap size={13} className="text-white" fill="white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-black">MeetNPlan</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification bell — mobile */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F5F5F5] transition-colors relative"
              >
                <Bell size={17} className="text-black" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotificationDropdown
                  notifications={notifications}
                  onMarkRead={markNotificationRead}
                  onMarkAll={markAllNotificationsRead}
                  onClose={() => setNotifOpen(false)}
                />
              )}
            </div>

            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F5F5F5] transition-colors"
            >
              <Menu size={18} className="text-black" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col max-w-[1180px] w-full mx-auto p-4 md:p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
