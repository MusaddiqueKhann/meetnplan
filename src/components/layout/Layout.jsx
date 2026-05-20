import { useState } from 'react'
import { Menu, Zap, Bell } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout({
  currentPage, onNavigate, onOpenModal, rooms, bookings, checkedRooms, toggleRoom,
  onLogout, user, children, unreadCount = 0,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
        onNavigateProfile={() => handleNavigate('profile')}
        onNavigateNotifications={() => handleNavigate('notifications')}
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
            {/* Notification bell — mobile → navigates to notifications page */}
            <button
              onClick={() => handleNavigate('notifications')}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F5F5F5] transition-colors relative"
            >
              <Bell size={17} className="text-black" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

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
