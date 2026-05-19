import { useState, useEffect, useRef, useCallback } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { Zap } from 'lucide-react'
import { db, auth } from './firebase'
import SplashPage      from './pages/SplashPage'
import Dashboard       from './pages/Dashboard'
import Calendar        from './pages/Calendar'
import Rooms           from './pages/Rooms'
import TodaysMeetings  from './pages/TodaysMeetings'
import Profile         from './pages/Profile'
import AdminPanel      from './pages/admin/AdminPanel'
import Layout          from './components/layout/Layout'
import ScheduleMeetingModal from './components/modals/ScheduleMeetingModal'

function getWorkWeek() {
  const d      = new Date()
  const dow    = d.getDay()
  const offset = dow <= 4 ? -dow : 7 - dow
  const sun    = new Date(d)
  sun.setDate(d.getDate() + offset)
  sun.setHours(0, 0, 0, 0)
  const thu = new Date(sun)
  thu.setDate(sun.getDate() + 4)
  const fmt = x =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return { start: fmt(sun), end: fmt(thu), key: fmt(sun) }
}

function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F9F9F9]">
      <div className="flex flex-col items-center gap-6">
        {/* Logo mark */}
        <div className="relative">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-xl">
            <Zap size={28} className="text-white" fill="white" />
          </div>
          {/* Spinning ring */}
          <div className="absolute -inset-1.5 rounded-[18px] border-2 border-transparent border-t-black animate-spin" />
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[15px] font-bold text-black tracking-tight">MeetNPlan</p>
          <p className="text-[12px] text-neutral-400 font-medium">Setting up your workspace…</p>
        </div>

        {/* Animated dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [authLoading,  setAuthLoading]  = useState(true)
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [userProfile,  setUserProfile]  = useState(null)
  const [page,         setPage]         = useState('dashboard')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [rooms,        setRooms]        = useState([])
  const [bookings,     setBookings]     = useState([])
  const [weekRange,    setWeekRange]    = useState(getWorkWeek)
  const [checkedRooms, setCheckedRooms] = useState(new Set())
  const [settings,     setSettings]     = useState({ maxBookingDurationMins: 180, maxDaysAhead: 30, workStartHour: 8, workEndHour: 20, offDays: [5, 6], companies: ['Wolfhead', 'CloudGate', 'CodeLtd'] })

  // Firebase Auth state listener
  useEffect(() => {
    return onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser)
      if (!fbUser) {
        setUserProfile(null)
        setAuthLoading(false)
      }
    })
  }, [])

  // Live user profile listener — also catches new Google users (profile = null until they complete it)
  useEffect(() => {
    if (!firebaseUser) return
    const unsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      setUserProfile(snap.exists() ? snap.data() : null)
      setAuthLoading(false)
    })
    return unsub
  }, [firebaseUser?.uid])

  // Live settings listener — updates instantly when admin saves changes
  useEffect(() => {
    if (!firebaseUser) return
    return onSnapshot(doc(db, 'settings', 'config'), snap => {
      if (snap.exists()) setSettings(s => ({ ...s, ...snap.data() }))
    }, () => {})
  }, [firebaseUser?.uid])

  // Rooms + Bookings listeners — start only once authenticated
  useEffect(() => {
    if (!firebaseUser) return
    const unsubRooms    = onSnapshot(collection(db, 'rooms'),    snap => setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const unsubBookings = onSnapshot(collection(db, 'bookings'), snap => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => { unsubRooms(); unsubBookings() }
  }, [firebaseUser?.uid])

  // Keep checkedRooms in sync when room list changes
  useEffect(() => {
    setCheckedRooms(new Set(rooms.map(r => r.name)))
  }, [rooms.length])

  // Advance week range each minute
  useEffect(() => {
    const id = setInterval(() => setWeekRange(getWorkWeek()), 60_000)
    return () => clearInterval(id)
  }, [])

  const deleteBooking = useCallback(async (id) => {
    await deleteDoc(doc(db, 'bookings', id))
  }, [])

  const addRoom    = async (room)     => { const { id, ...data } = room; await addDoc(collection(db, 'rooms'), data) }
  const removeRoom = async (id)       => { await deleteDoc(doc(db, 'rooms', id)) }
  const updateRoom = async (id, data) => { await updateDoc(doc(db, 'rooms', id), data) }
  const addBooking = async (booking)  => { const { id, ...data } = booking; await addDoc(collection(db, 'bookings'), data) }

  const handleLogout = async () => {
    await signOut(auth)
    setPage('dashboard')
  }

  const toggleRoom = (name) => setCheckedRooms(prev => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  if (authLoading) return <LoadingScreen />

  // Not authenticated, or Google user who hasn't completed their profile yet
  if (!firebaseUser || !userProfile) {
    return (
      <SplashPage
        needsGoogleProfile={!!firebaseUser && !userProfile}
        googleUser={firebaseUser}
        companies={settings.companies}
      />
    )
  }

  const user = {
    uid:          firebaseUser.uid,
    email:        firebaseUser.email,
    emailVerified: firebaseUser.emailVerified,
    name:         userProfile.name    ?? firebaseUser.displayName ?? '',
    company:      userProfile.company ?? '',
    role:         userProfile.role    ?? 'user',
    photoURL:     firebaseUser.photoURL ?? null,
    isGoogleUser: firebaseUser.providerData?.[0]?.providerId === 'google.com',
  }

  // Guard non-admins away from the admin page
  const safePage = (page === 'admin' && user.role !== 'admin') ? 'dashboard' : page

  const sharedProps = { rooms, bookings, user }
  const pages = {
    dashboard: <Dashboard      {...sharedProps} onOpenModal={() => setModalOpen(true)} deleteBooking={deleteBooking} onNavigate={setPage} settings={settings} />,
    today:     <TodaysMeetings {...sharedProps} onOpenModal={() => setModalOpen(true)} deleteBooking={deleteBooking} />,
    calendar:  <Calendar       {...sharedProps} onOpenModal={() => setModalOpen(true)} deleteBooking={deleteBooking} weekKey={weekRange.key} checkedRooms={checkedRooms} settings={settings} />,
    rooms:     <Rooms          {...sharedProps} onOpenModal={() => setModalOpen(true)} onAddRoom={addRoom} onRemoveRoom={removeRoom} onNavigate={setPage} />,
    profile:   <Profile        user={user}      onNavigate={setPage} onLogout={handleLogout} bookings={bookings} deleteBooking={deleteBooking} />,
    admin:     <AdminPanel     {...sharedProps} onAddRoom={addRoom} onRemoveRoom={removeRoom} onUpdateRoom={updateRoom} deleteBooking={deleteBooking} />,
  }

  return (
    <>
      <Layout
        currentPage={safePage}
        onNavigate={setPage}
        onOpenModal={() => setModalOpen(true)}
        rooms={rooms}
        bookings={bookings}
        checkedRooms={checkedRooms}
        toggleRoom={toggleRoom}
        onLogout={handleLogout}
        user={user}
      >
        {pages[safePage] ?? pages.dashboard}
      </Layout>

      <ScheduleMeetingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        rooms={rooms}
        bookings={bookings}
        onBook={addBooking}
        weekStart={weekRange.start}
        weekEnd={weekRange.end}
        user={user}
        settings={settings}
      />
    </>
  )
}
