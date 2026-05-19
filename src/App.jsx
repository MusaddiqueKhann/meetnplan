import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
  query, where, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { Zap } from 'lucide-react'
import { db, auth } from './firebase'
import SplashPage           from './pages/SplashPage'
import Dashboard            from './pages/Dashboard'
import Calendar             from './pages/Calendar'
import Rooms                from './pages/Rooms'
import TodaysMeetings       from './pages/TodaysMeetings'
import Profile              from './pages/Profile'
import AdminPanel           from './pages/admin/AdminPanel'
import Layout               from './components/layout/Layout'
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
        <div className="relative">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-xl">
            <Zap size={28} className="text-white" fill="white" />
          </div>
          <div className="absolute -inset-1.5 rounded-[18px] border-2 border-transparent border-t-black animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[15px] font-bold text-black tracking-tight">MeetNPlan</p>
          <p className="text-[12px] text-neutral-400 font-medium">Setting up your workspace…</p>
        </div>
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
  const [authLoading,    setAuthLoading]    = useState(true)
  const [firebaseUser,   setFirebaseUser]   = useState(null)
  const [userProfile,    setUserProfile]    = useState(null)
  const [page,           setPage]           = useState('dashboard')
  const [modalOpen,      setModalOpen]      = useState(false)
  const [rooms,          setRooms]          = useState([])
  const [bookings,       setBookings]       = useState([])
  const [notifications,  setNotifications]  = useState([])
  const [meetingHistory, setMeetingHistory] = useState([])
  const [weekRange,      setWeekRange]      = useState(getWorkWeek)
  const [checkedRooms,   setCheckedRooms]   = useState(new Set())
  const [settings,       setSettings]       = useState({
    maxBookingDurationMins: 180, maxDaysAhead: 30, workStartHour: 8,
    workEndHour: 20, offDays: [5, 6], companies: ['Wolfhead', 'CloudGate', 'CodeLtd'],
  })

  // Keep refs so callbacks always access current data without stale closures
  const bookingsRef      = useRef(bookings)
  const notificationsRef = useRef(notifications)
  useEffect(() => { bookingsRef.current      = bookings      }, [bookings])
  useEffect(() => { notificationsRef.current = notifications }, [notifications])

  // Firebase Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser)
      if (!fbUser) { setUserProfile(null); setAuthLoading(false) }
    })
  }, [])

  // User profile listener
  useEffect(() => {
    if (!firebaseUser) return
    const unsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      setUserProfile(snap.exists() ? snap.data() : null)
      setAuthLoading(false)
    })
    return unsub
  }, [firebaseUser?.uid])

  // Settings listener
  useEffect(() => {
    if (!firebaseUser) return
    return onSnapshot(doc(db, 'settings', 'config'), snap => {
      if (snap.exists()) setSettings(s => ({ ...s, ...snap.data() }))
    }, () => {})
  }, [firebaseUser?.uid])

  // Rooms + Bookings listeners
  useEffect(() => {
    if (!firebaseUser) return
    const unsubRooms    = onSnapshot(collection(db, 'rooms'),    snap => setRooms(snap.docs.map(d => ({ ...d.data(), id: d.id }))))
    const unsubBookings = onSnapshot(collection(db, 'bookings'), snap => setBookings(snap.docs.map(d => ({ ...d.data(), id: d.id }))))
    return () => { unsubRooms(); unsubBookings() }
  }, [firebaseUser?.uid])

  // Notifications listener — scoped to current user
  useEffect(() => {
    if (!firebaseUser?.email) return
    const q = query(collection(db, 'notifications'), where('toEmail', '==', firebaseUser.email))
    return onSnapshot(q, snap => {
      const notifs = snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setNotifications(notifs)
    }, () => {})
  }, [firebaseUser?.uid, firebaseUser?.email])

  // Meeting history listener
  useEffect(() => {
    if (!firebaseUser) return
    return onSnapshot(collection(db, 'meetingHistory'), snap => {
      const hist = snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      setMeetingHistory(hist)
    }, () => {})
  }, [firebaseUser?.uid])

  // Sync checkedRooms when rooms change
  useEffect(() => {
    setCheckedRooms(new Set(rooms.map(r => r.name)))
  }, [rooms.length])

  // Advance week every minute
  useEffect(() => {
    const id = setInterval(() => setWeekRange(getWorkWeek()), 60_000)
    return () => clearInterval(id)
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const sendNotification = useCallback(async (data) => {
    try {
      await addDoc(collection(db, 'notifications'), { ...data, read: false, createdAt: serverTimestamp() })
    } catch (_) {}
  }, [])

  const logHistory = useCallback(async (data) => {
    try {
      await addDoc(collection(db, 'meetingHistory'), { ...data, createdAt: serverTimestamp() })
    } catch (_) {}
  }, [])

  // Smart booking — handles normal bookings and client-meeting priority flow
  const bookWithPriority = useCallback(async (booking) => {
    const { conflictsWith, ...bookingData } = booking
    // conflictsWith is now an array of all conflicting bookings
    const conflicts = Array.isArray(conflictsWith) ? conflictsWith : (conflictsWith ? [conflictsWith] : [])

    if (booking.meetingType === 'client' && conflicts.length > 0) {
      // Client meeting that conflicts with existing bookings → priority flow
      const batch  = writeBatch(db)
      const newRef = doc(collection(db, 'bookings'))
      const newId  = newRef.id

      batch.set(newRef, {
        ...bookingData,
        status:           'priority_pending',
        conflictsWithIds: conflicts.map(c => c.id),
        createdAt:        serverTimestamp(),
      })

      for (const conflict of conflicts) {
        batch.update(doc(db, 'bookings', conflict.id), {
          status:             'waiting_for_action',
          priorityRequestId:  newId,
          waitingForActionAt: serverTimestamp(),
        })
      }
      await batch.commit()

      for (const conflict of conflicts) {
        await sendNotification({
          toEmail:              conflict.ownerEmail,
          toUid:                conflict.ownerUid ?? '',
          fromEmail:            bookingData.ownerEmail,
          fromName:             bookingData.coordinator,
          fromCompany:          bookingData.companyName,
          type:                 'priority_request',
          message:              `Your meeting "${conflict.title}" conflicts with the high-priority client meeting "${bookingData.title}". Please reschedule or cancel your meeting to accommodate this booking.`,
          bookingId:            conflict.id,
          relatedBookingId:     newId,
          clientName:           bookingData.clientName ?? '',
          clientMeetingTitle:   bookingData.title,
          existingMeetingTitle: conflict.title,
          room:                 bookingData.room,
          date:                 bookingData.date,
          startMinutes:         bookingData.startMinutes,
          endMinutes:           bookingData.endMinutes,
          totalConflicts:       conflicts.length,
        })
      }

      await logHistory({
        bookingId:        newId,
        bookingTitle:     bookingData.title,
        action:           'priority_created',
        performedBy:      bookingData.coordinator,
        performedByEmail: bookingData.ownerEmail,
        meetingType:      'client',
        clientName:       bookingData.clientName ?? '',
        room:             bookingData.room,
        date:             bookingData.date,
        startMinutes:     bookingData.startMinutes,
        endMinutes:       bookingData.endMinutes,
        conflictsWithIds: conflicts.map(c => c.id),
        reason:           null,
      })
    } else {
      // Normal booking
      const batch  = writeBatch(db)
      const newRef = doc(collection(db, 'bookings'))
      const newId  = newRef.id
      batch.set(newRef, { ...bookingData, status: 'approved', createdAt: serverTimestamp() })
      await batch.commit()

      await logHistory({
        bookingId:        newId,
        bookingTitle:     bookingData.title,
        action:           'created',
        performedBy:      bookingData.coordinator,
        performedByEmail: bookingData.ownerEmail,
        meetingType:      bookingData.meetingType ?? 'internal',
        clientName:       bookingData.clientName ?? null,
        room:             bookingData.room,
        date:             bookingData.date,
        startMinutes:     bookingData.startMinutes,
        endMinutes:       bookingData.endMinutes,
        reason:           null,
      })
    }
  }, [sendNotification, logHistory])

  // Delete a booking with a mandatory reason, then auto-approve the pending client meeting
  // if this was the last remaining conflict blocking it
  const deleteBookingWithReason = useCallback(async (booking, reason) => {
    const batch = writeBatch(db)
    batch.delete(doc(db, 'bookings', booking.id))

    // Check if there are other waiting_for_action bookings for the same client meeting
    const remainingConflicts = booking.priorityRequestId
      ? bookingsRef.current.filter(b =>
          b.id !== booking.id &&
          b.priorityRequestId === booking.priorityRequestId &&
          b.status === 'waiting_for_action'
        )
      : []
    const isLastConflict = booking.priorityRequestId && remainingConflicts.length === 0

    if (isLastConflict) {
      batch.update(doc(db, 'bookings', booking.priorityRequestId), {
        status:           'approved',
        approvedAt:       serverTimestamp(),
        conflictsWithIds: [],
      })
    }
    await batch.commit()

    // Auto-dismiss the priority_request notification for this booking
    const prNotif = notificationsRef.current.find(n =>
      n.type === 'priority_request' && n.bookingId === booking.id && !n.read
    )
    if (prNotif?.id) {
      await updateDoc(doc(db, 'notifications', prNotif.id), { read: true })
    }

    await logHistory({
      bookingId:        booking.id,
      bookingTitle:     booking.title,
      action:           'deleted_with_reason',
      performedBy:      booking.coordinator,
      performedByEmail: booking.ownerEmail,
      room:             booking.room,
      date:             booking.date,
      startMinutes:     booking.startMinutes,
      endMinutes:       booking.endMinutes,
      reason,
    })

    if (isLastConflict) {
      const clientMeeting = bookingsRef.current.find(b => b.id === booking.priorityRequestId)
      if (clientMeeting) {
        await sendNotification({
          toEmail:          clientMeeting.ownerEmail,
          toUid:            clientMeeting.ownerUid ?? '',
          fromEmail:        booking.ownerEmail,
          fromName:         booking.coordinator,
          type:             'meeting_approved',
          message:          'Your client meeting has been approved — all conflicting meetings have been resolved.',
          bookingId:        clientMeeting.id,
          relatedBookingId: booking.id,
        })
        await logHistory({
          bookingId:        clientMeeting.id,
          bookingTitle:     clientMeeting.title,
          action:           'approved',
          performedBy:      booking.coordinator,
          performedByEmail: booking.ownerEmail,
          room:             clientMeeting.room,
          date:             clientMeeting.date,
          startMinutes:     clientMeeting.startMinutes,
          endMinutes:       clientMeeting.endMinutes,
          reason:           'All conflicting meetings resolved by owners',
        })
      }
    }
  }, [logHistory, sendNotification])

  // Reschedule a booking to a new slot, then auto-approve the pending client meeting
  // if this was the last remaining conflict blocking it
  const rescheduleBooking = useCallback(async (booking, newData) => {
    // Check if there are other waiting_for_action bookings for the same client meeting
    const remainingConflicts = booking.priorityRequestId
      ? bookingsRef.current.filter(b =>
          b.id !== booking.id &&
          b.priorityRequestId === booking.priorityRequestId &&
          b.status === 'waiting_for_action'
        )
      : []
    const isLastConflict = booking.priorityRequestId && remainingConflicts.length === 0

    const batch = writeBatch(db)
    batch.update(doc(db, 'bookings', booking.id), {
      ...newData,
      status:            'rescheduled',
      rescheduledAt:     serverTimestamp(),
      priorityRequestId: null,
    })

    if (isLastConflict) {
      batch.update(doc(db, 'bookings', booking.priorityRequestId), {
        status:           'approved',
        approvedAt:       serverTimestamp(),
        conflictsWithIds: [],
      })
    }
    await batch.commit()

    // Auto-dismiss the priority_request notification for this booking
    const prNotif = notificationsRef.current.find(n =>
      n.type === 'priority_request' && n.bookingId === booking.id && !n.read
    )
    if (prNotif?.id) {
      await updateDoc(doc(db, 'notifications', prNotif.id), { read: true })
    }

    await logHistory({
      bookingId:        booking.id,
      bookingTitle:     booking.title,
      action:           'rescheduled',
      performedBy:      booking.coordinator,
      performedByEmail: booking.ownerEmail,
      room:             booking.room,
      date:             booking.date,
      startMinutes:     booking.startMinutes,
      endMinutes:       booking.endMinutes,
      newDate:          newData.date,
      newStartMinutes:  newData.startMinutes,
      newEndMinutes:    newData.endMinutes,
      newRoom:          newData.room,
      reason:           null,
    })

    if (isLastConflict) {
      const clientMeeting = bookingsRef.current.find(b => b.id === booking.priorityRequestId)
      if (clientMeeting) {
        await sendNotification({
          toEmail:          clientMeeting.ownerEmail,
          toUid:            clientMeeting.ownerUid ?? '',
          fromEmail:        booking.ownerEmail,
          fromName:         booking.coordinator,
          type:             'meeting_approved',
          message:          'Your client meeting has been approved — all conflicting meetings have been resolved.',
          bookingId:        clientMeeting.id,
          relatedBookingId: booking.id,
        })
        await logHistory({
          bookingId:        clientMeeting.id,
          bookingTitle:     clientMeeting.title,
          action:           'approved',
          performedBy:      booking.coordinator,
          performedByEmail: booking.ownerEmail,
          room:             clientMeeting.room,
          date:             clientMeeting.date,
          startMinutes:     clientMeeting.startMinutes,
          endMinutes:       clientMeeting.endMinutes,
          reason:           'All conflicting meetings resolved by owners',
        })
      }
    }
  }, [logHistory, sendNotification])

  // Admin forcefully removes one stale "waiting_for_action" meeting.
  // Client meeting is only approved when this is the last conflict blocking it.
  const adminOverrideApprove = useCallback(async (conflictingBooking, clientBooking) => {
    const remainingConflicts = bookingsRef.current.filter(b =>
      b.id !== conflictingBooking.id &&
      b.priorityRequestId === clientBooking.id &&
      b.status === 'waiting_for_action'
    )
    const isLastConflict = remainingConflicts.length === 0

    const batch = writeBatch(db)
    batch.delete(doc(db, 'bookings', conflictingBooking.id))
    if (isLastConflict) {
      batch.update(doc(db, 'bookings', clientBooking.id), {
        status:           'approved',
        approvedAt:       serverTimestamp(),
        conflictsWithIds: [],
      })
    }
    await batch.commit()

    await sendNotification({
      toEmail:          conflictingBooking.ownerEmail,
      toUid:            conflictingBooking.ownerUid ?? '',
      fromEmail:        'admin',
      fromName:         'Admin',
      type:             'admin_override',
      message:          'Your meeting has been deleted by the admin because it was clashing with a client meeting.',
      bookingId:        conflictingBooking.id,
      relatedBookingId: clientBooking.id,
      room:             conflictingBooking.room,
      date:             conflictingBooking.date,
      startMinutes:     conflictingBooking.startMinutes,
      endMinutes:       conflictingBooking.endMinutes,
    })

    await logHistory({
      bookingId:        conflictingBooking.id,
      bookingTitle:     conflictingBooking.title,
      action:           'admin_override_deleted',
      performedBy:      'Admin',
      performedByEmail: firebaseUser?.email ?? 'admin',
      room:             conflictingBooking.room,
      date:             conflictingBooking.date,
      startMinutes:     conflictingBooking.startMinutes,
      endMinutes:       conflictingBooking.endMinutes,
      reason:           'Admin override — meeting was clashing with a client meeting and owner did not act within 5 minutes of the priority request being created.',
    })

    if (isLastConflict) {
      await logHistory({
        bookingId:        clientBooking.id,
        bookingTitle:     clientBooking.title,
        action:           'approved',
        performedBy:      'Admin',
        performedByEmail: firebaseUser?.email ?? 'admin',
        room:             clientBooking.room,
        date:             clientBooking.date,
        startMinutes:     clientBooking.startMinutes,
        endMinutes:       clientBooking.endMinutes,
        reason:           'Admin override — all conflicting meetings deleted by admin.',
      })
    }
  }, [sendNotification, logHistory, firebaseUser?.email])

  // Owner withdraws their own priority_pending client meeting before approval.
  // Restores all affected waiting_for_action bookings back to approved.
  const cancelClientBooking = useCallback(async (booking) => {
    const batch = writeBatch(db)
    batch.delete(doc(db, 'bookings', booking.id))

    const rawIds = Array.isArray(booking.conflictsWithIds)
      ? booking.conflictsWithIds
      : booking.conflictsWithId ? [booking.conflictsWithId] : []
    const conflictIds = rawIds.filter(id => typeof id === 'string' && id.length > 0)

    const affected = bookingsRef.current.filter(b =>
      typeof b.id === 'string' && b.id.length > 0 &&
      (conflictIds.includes(b.id) || b.priorityRequestId === booking.id)
    )
    for (const cb of affected) {
      batch.update(doc(db, 'bookings', cb.id), {
        status:             'approved',
        priorityRequestId:  null,
        waitingForActionAt: null,
      })
    }
    await batch.commit()

    for (const cb of affected) {
      await sendNotification({
        toEmail:          cb.ownerEmail,
        toUid:            cb.ownerUid ?? '',
        fromEmail:        booking.ownerEmail,
        fromName:         booking.coordinator,
        type:             'meeting_approved',
        message:          `${booking.coordinator} has withdrawn their client meeting request "${booking.title}". Your booking is confirmed.`,
        bookingId:        cb.id,
        relatedBookingId: booking.id,
      })
    }

    await logHistory({
      bookingId:        booking.id,
      bookingTitle:     booking.title,
      action:           'deleted_with_reason',
      performedBy:      booking.coordinator,
      performedByEmail: booking.ownerEmail,
      meetingType:      'client',
      clientName:       booking.clientName ?? '',
      room:             booking.room,
      date:             booking.date,
      startMinutes:     booking.startMinutes,
      endMinutes:       booking.endMinutes,
      reason:           'Client meeting withdrawn by owner before approval',
    })
  }, [logHistory, sendNotification])

  const markNotificationRead = useCallback(async (notifId) => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true })
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.read)
    await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })))
  }, [notifications])

  const deleteBooking = useCallback(async (id) => {
    await deleteDoc(doc(db, 'bookings', id))
  }, [])

  const addRoom    = async (room)     => { const { id, ...data } = room; await addDoc(collection(db, 'rooms'), data) }
  const removeRoom = async (id)       => { await deleteDoc(doc(db, 'rooms', id)) }
  const updateRoom = async (id, data) => { await updateDoc(doc(db, 'rooms', id), data) }

  const handleLogout = async () => { await signOut(auth); setPage('dashboard') }

  const toggleRoom = (name) => setCheckedRooms(prev => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })

  if (authLoading) return <LoadingScreen />

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

  const safePage   = (page === 'admin' && user.role !== 'admin') ? 'dashboard' : page
  const unreadCount = notifications.filter(n => !n.read).length

  const sharedProps = { rooms, bookings, user, notifications, meetingHistory }

  const pages = {
    dashboard: (
      <Dashboard
        {...sharedProps}
        onOpenModal={() => setModalOpen(true)}
        deleteBooking={deleteBooking}
        onNavigate={setPage}
        settings={settings}
        markNotificationRead={markNotificationRead}
        markAllNotificationsRead={markAllNotificationsRead}
      />
    ),
    today: (
      <TodaysMeetings {...sharedProps} onOpenModal={() => setModalOpen(true)} deleteBooking={deleteBooking} rescheduleBooking={rescheduleBooking} settings={settings} />
    ),
    calendar: (
      <Calendar
        {...sharedProps}
        onOpenModal={() => setModalOpen(true)}
        deleteBooking={deleteBooking}
        weekKey={weekRange.key}
        checkedRooms={checkedRooms}
        settings={settings}
      />
    ),
    rooms: (
      <Rooms {...sharedProps} onOpenModal={() => setModalOpen(true)} onAddRoom={addRoom} onRemoveRoom={removeRoom} onNavigate={setPage} />
    ),
    profile: (
      <Profile
        user={user}
        onNavigate={setPage}
        onLogout={handleLogout}
        bookings={bookings}
        deleteBooking={deleteBooking}
        notifications={notifications}
        meetingHistory={meetingHistory}
        markNotificationRead={markNotificationRead}
        deleteBookingWithReason={deleteBookingWithReason}
        rescheduleBooking={rescheduleBooking}
        cancelClientBooking={cancelClientBooking}
        rooms={rooms}
        settings={settings}
      />
    ),
    admin: (
      <AdminPanel
        {...sharedProps}
        onAddRoom={addRoom}
        onRemoveRoom={removeRoom}
        onUpdateRoom={updateRoom}
        deleteBooking={deleteBooking}
        meetingHistory={meetingHistory}
        adminOverrideApprove={adminOverrideApprove}
      />
    ),
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
        notifications={notifications}
        unreadCount={unreadCount}
        markNotificationRead={markNotificationRead}
        markAllNotificationsRead={markAllNotificationsRead}
      >
        {pages[safePage] ?? pages.dashboard}
      </Layout>

      <ScheduleMeetingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        rooms={rooms}
        bookings={bookings}
        onBook={bookWithPriority}
        weekStart={weekRange.start}
        weekEnd={weekRange.end}
        user={user}
        settings={settings}
      />
    </>
  )
}
