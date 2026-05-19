import { useState } from 'react'
import { Menu, Zap } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout({ currentPage, onNavigate, onOpenModal, rooms, bookings, checkedRooms, toggleRoom, onLogout, user, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleNavigate  = (page) => { onNavigate(page); setSidebarOpen(false) }
  const handleOpenModal = ()     => { onOpenModal();    setSidebarOpen(false) }

  return (
    <div className="flex w-full min-h-screen bg-[#F9F9F9]">

      {/* Mobile backdrop */}
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
      />

      <main className="flex-1 lg:ml-[260px] min-h-screen flex flex-col">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#EBEBEB] sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap size={13} className="text-white" fill="white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-black">MeetNPlan</span>
          </div>
          <button onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F5F5F5] transition-colors">
            <Menu size={18} className="text-black" />
          </button>
        </header>

        <div className="flex-1 flex flex-col max-w-[1180px] w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
