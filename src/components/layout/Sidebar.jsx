import { useState } from 'react'
import {
  LayoutDashboard, Calendar, Building2, PlusCircle, ChevronRight,
  Zap, CalendarClock, X, LogOut, ShieldCheck, Bell,
} from 'lucide-react'

const BASE_NAV = [
  { id: 'dashboard', label: 'Dashboard',        icon: LayoutDashboard },
  { id: 'today',     label: "Today's Meetings", icon: CalendarClock   },
  { id: 'calendar',  label: 'Calendar',         icon: Calendar        },
  { id: 'rooms',     label: 'Meeting Rooms',    icon: Building2       },
]

function pad(n) { return String(n).padStart(2, '0') }
function minsToAmPm(m) {
  const h   = Math.floor(m / 60)
  const min = m % 60
  const p   = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${pad(min)} ${p}`
}
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Sidebar({
  currentPage, onNavigate, onOpenModal, rooms = [], bookings = [],
  checkedRooms = new Set(), toggleRoom, isOpen, onClose, onLogout, user,
  unreadCount = 0, onNavigateProfile, onNavigateNotifications,
}) {
  const now        = new Date()
  const todayStr   = dateToStr(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const navItems = user?.role === 'admin'
    ? [...BASE_NAV, { id: 'admin', label: 'Admin Panel', icon: ShieldCheck }]
    : BASE_NAV

  const isActive = (b) =>
    !b.status || b.status === 'approved' || b.status === 'rescheduled' ||
    b.status === 'waiting_for_action' // waiting_for_action kept for backwards-compatibility with legacy data

  const isRoomLive = (roomName) => bookings.some(b =>
    isActive(b) && b.room === roomName && b.date === todayStr &&
    nowMinutes >= b.startMinutes && nowMinutes < b.endMinutes
  )

  const nextBooking = bookings
    .filter(b => isActive(b) && (b.date > todayStr || (b.date === todayStr && b.endMinutes > nowMinutes)))
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.startMinutes - b.startMinutes)[0] || null

  const isCalendar = currentPage === 'calendar'

  return (
    <aside className={`w-[260px] bg-white border-r border-[#EBEBEB] flex flex-col fixed left-0 top-0 bottom-0 z-50 overflow-y-auto transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

      {/* Logo */}
      <div className="px-6 pt-7 pb-6 border-b border-[#EBEBEB] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-tight text-black leading-none">MeetNPlan</p>
            <p className="text-[10px] text-[#AAA] mt-0.5 leading-none">Room Management</p>
          </div>
        </div>
        <button onClick={onClose}
          className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] transition-colors">
          <X size={14} className="text-[#666]" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-4 py-6 flex flex-col gap-6">
        <div>
          <p className="px-2 mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#BBBBBB]">Workspace</p>
          <div className="space-y-0.5">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active  = currentPage === id
              const isAdmin = id === 'admin'
              return (
                <button key={id} onClick={() => onNavigate(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group
                    ${active
                      ? isAdmin ? 'bg-indigo-600 text-white shadow-sm' : 'bg-black text-white shadow-sm'
                      : 'text-[#555] hover:bg-[#F5F5F5] hover:text-black'}`}>
                  <Icon size={15} className={active ? 'text-white' : `${isAdmin ? 'text-indigo-400' : 'text-[#AAAAAA]'} group-hover:text-black transition-colors`} />
                  <span className="flex-1 text-left leading-none">{label}</span>
                  {active && <ChevronRight size={13} className="text-white/40" />}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="px-2 mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#BBBBBB]">Actions</p>
          <button onClick={onOpenModal}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#555] hover:bg-[#F5F5F5] hover:text-black transition-all duration-150 group">
            <PlusCircle size={15} className="text-[#AAAAAA] group-hover:text-black transition-colors" />
            <span className="leading-none">Schedule Meeting</span>
          </button>
        </div>
      </nav>

      {/* Calendar room filter + up-next panel */}
      {isCalendar && (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-6 flex flex-col gap-4 border-t border-[#EBEBEB] pt-5">
          <div className="bg-[#F9F9F9] rounded-2xl p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#BBBBBB] mb-3">Rooms</p>
            {rooms.length === 0 ? (
              <p className="text-xs text-[#CCCCCC] font-medium">No rooms added</p>
            ) : (
              <div className="space-y-1">
                {rooms.map(room => {
                  const live    = isRoomLive(room.name)
                  const checked = checkedRooms.has(room.name)
                  return (
                    <button key={room.id} onClick={() => toggleRoom?.(room.name)}
                      className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-white transition-colors group">
                      <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${checked ? 'bg-black border-black' : 'bg-white border-[#DDDDDD] group-hover:border-[#AAAAAA]'}`}>
                        {checked && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className="flex-1 text-left text-xs font-medium text-black truncate">{room.name}</span>
                      {live && <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0 animate-pulse" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {nextBooking ? (
            <div className="bg-black rounded-2xl p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/40 mb-2.5">Up Next</p>
              <p className="text-sm font-bold text-white leading-snug truncate">{nextBooking.title}</p>
              <p className="text-[11px] text-white/50 mt-1 font-medium truncate">{nextBooking.room}</p>
              <p className="text-[11px] text-white/70 mt-0.5 font-semibold">
                {minsToAmPm(nextBooking.startMinutes)} – {minsToAmPm(nextBooking.endMinutes)}
              </p>
              {(nextBooking.coordinator || nextBooking.companyName) && (
                <p className="text-[10px] text-white/35 mt-1.5 truncate">
                  {nextBooking.coordinator || nextBooking.companyName}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-[#F9F9F9] border border-[#EBEBEB] rounded-2xl p-4 flex flex-col items-center gap-2">
              <CalendarClock size={18} className="text-[#DDD]" />
              <p className="text-[10px] font-semibold text-[#CCCCCC] text-center">No upcoming bookings</p>
            </div>
          )}
        </div>
      )}

      {/* User card — pinned to bottom */}
      {user && (
        <div className="mt-auto border-t border-[#EBEBEB] px-4 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateProfile?.() ?? onNavigate?.('profile')}
              className={`flex items-center gap-3 flex-1 min-w-0 rounded-xl px-1 py-1 -mx-1 transition-colors hover:bg-[#F5F5F5] group ${currentPage === 'profile' ? 'bg-[#F5F5F5]' : ''}`}
            >
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user.photoURL
                  ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[12px] font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[10px] font-semibold text-[#BBBBBB] uppercase tracking-wider leading-none mb-0.5">Welcome back</p>
                <p className="text-[13px] font-semibold text-black leading-tight truncate">{user.name}</p>
              </div>
            </button>

            {/* Notification bell — desktop only → navigates to notifications page */}
            <div className="hidden lg:block">
              <button
                onClick={() => onNavigateNotifications?.()}
                title="Notifications"
                className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] transition-colors group relative ${currentPage === 'notifications' ? 'bg-[#F5F5F5]' : ''}`}
              >
                <Bell size={14} className={`transition-colors ${currentPage === 'notifications' ? 'text-black' : 'text-[#CCCCCC] group-hover:text-black'}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            <button onClick={onLogout} title="Log out"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] transition-colors group flex-shrink-0">
              <LogOut size={14} className="text-[#CCCCCC] group-hover:text-black transition-colors" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
