import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
  query, where, serverTimestamp, writeBatch, runTransaction,
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

  // ── Priority Approval Logic ───────────────────────────────────────────────

  // Smart booking — normal bookings get approved immediately.
  // Client meetings that conflict with existing confirmed bookings enter the
  // pending_priority_approval flow: they are invisible in all calendar/dashboard
  // views and require explicit approval from each conflicting meeting owner.
  const bookWithPriority = useCallback(async (booking) => {
    const { conflictsWith, ...bookingData } = booking
    const conflicts = Array.isArray(conflictsWith) ? conflictsWith : (conflictsWith ? [conflictsWith] : [])

    if (booking.meetingType === 'client' && conflicts.length > 0) {
      const batch  = writeBatch(db)
      const newRef = doc(collection(db, 'bookings'))
      const newId  = newRef.id

      batch.set(newRef, {
        ...bookingData,
        // INVARIANT: existing confirmed meetings MUST NOT be altered until this
        // request receives 100% approval. They stay 'approved' and visible.
        status:              'pending_priority_approval',
        conflictsWithIds:    conflicts.map(c => c.id),
        approvedConflictIds: [],
        createdAt:           serverTimestamp(),
      })
      // Existing meetings are NOT changed — they remain 'approved' and fully visible.
      await batch.commit()

      for (const conflict of conflicts) {
        await sendNotification({
          toEmail:              conflict.ownerEmail,
          toUid:                conflict.ownerUid ?? '',
          fromEmail:            bookingData.ownerEmail,
          fromName:             bookingData.coordinator,
          fromCompany:          bookingData.companyName,
          type:                 'priority_request',
          message:              `A high-priority client meeting "${bookingData.title}" is requesting your slot. Please approve or reject this override request.`,
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
      // Normal booking — approved immediately
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

  // Called when a conflicting meeting owner explicitly approves the override.
  // Uses a Firestore transaction for race-condition safety (spec §6 edge case).
  // All-or-nothing: the client meeting is only CONFIRMED when every conflict owner approves.
  const approvePriorityRequest = useCallback(async (priorityBookingId, conflictingBookingId, approvingUserEmail) => {
    let fullyApproved = false
    let priorityData  = null

    await runTransaction(db, async (tx) => {
      const pbSnap = await tx.get(doc(db, 'bookings', priorityBookingId))
      if (!pbSnap.exists()) return

      const pb = pbSnap.data()
      if (pb.status !== 'pending_priority_approval') return

      const resolved = [...(pb.approvedConflictIds ?? []), conflictingBookingId]
      const allDone  = (pb.conflictsWithIds ?? []).every(id => resolved.includes(id))

      if (allDone) {
        // FULL CONSENSUS — confirm the client meeting and cancel all conflicting meetings
        tx.update(doc(db, 'bookings', priorityBookingId), {
          status:              'approved',
          approvedAt:          serverTimestamp(),
          approvedConflictIds: resolved,
          conflictsWithIds:    [],
        })
        for (const cId of (pb.conflictsWithIds ?? [])) {
          // Only cancel meetings that still exist and still overlap the priority slot
          const conflict = bookingsRef.current.find(b => b.id === cId)
          if (conflict && conflict.status === 'approved') {
            const stillOverlaps = conflict.date === pb.date &&
              conflict.startMinutes < pb.endMinutes &&
              conflict.endMinutes > pb.startMinutes
            if (stillOverlaps) {
              tx.update(doc(db, 'bookings', cId), {
                status:               'cancelled',
                cancelledAt:          serverTimestamp(),
                cancelledByPriorityId: priorityBookingId,
              })
            }
          }
        }
        fullyApproved = true
        priorityData  = { ...pb, id: priorityBookingId }
      } else {
        // Partial approval — record this conflict as resolved, wait for others
        tx.update(doc(db, 'bookings', priorityBookingId), { approvedConflictIds: resolved })
      }
    })

    // Dismiss the approver's own priority_request notification
    const myNotif = notificationsRef.current.find(n =>
      n.type === 'priority_request' && n.relatedBookingId === priorityBookingId && !n.read
    )
    if (myNotif?.id) await updateDoc(doc(db, 'notifications', myNotif.id), { read: true })

    if (fullyApproved && priorityData) {
      // Dismiss any remaining priority_request notifications from other approvers
      // (their own dismissal happens when they open notifications next time)
      await sendNotification({
        toEmail:   priorityData.ownerEmail,
        toUid:     priorityData.ownerUid ?? '',
        fromEmail: approvingUserEmail,
        type:      'meeting_approved',
        message:   `Your client meeting "${priorityData.title}" has been fully approved — all conflicting owners accepted the override.`,
        bookingId: priorityBookingId,
      })
      await logHistory({
        bookingId:        priorityBookingId,
        bookingTitle:     priorityData.title,
        action:           'approved',
        performedBy:      approvingUserEmail,
        performedByEmail: approvingUserEmail,
        meetingType:      'client',
        clientName:       priorityData.clientName ?? '',
        room:             priorityData.room,
        date:             priorityData.date,
        startMinutes:     priorityData.startMinutes,
        endMinutes:       priorityData.endMinutes,
        reason:           'All required approvals received',
      })
    }
  }, [sendNotification, logHistory])

  // Called when a conflicting meeting owner rejects the override.
  // Instant rejection: the entire priority request is rejected immediately,
  // regardless of other owners who may have already approved.
  const rejectPriorityRequest = useCallback(async (priorityBookingId, rejectingUserEmail, autoRejectReason = null) => {
    const pb = bookingsRef.current.find(b => b.id === priorityBookingId)
    if (!pb || pb.status !== 'pending_priority_approval') return

    const batch = writeBatch(db)
    batch.update(doc(db, 'bookings', priorityBookingId), {
      status:     'rejected',
      rejectedAt: serverTimestamp(),
      rejectedBy: rejectingUserEmail,
    })
    await batch.commit()

    // Dismiss this user's own priority_request notification
    const myNotif = notificationsRef.current.find(n =>
      n.type === 'priority_request' && n.relatedBookingId === priorityBookingId && !n.read
    )
    if (myNotif?.id) await updateDoc(doc(db, 'notifications', myNotif.id), { read: true })

    const isAutoTimeout = rejectingUserEmail === 'system'
    const message = isAutoTimeout
      ? `Your client meeting "${pb.title}" was automatically rejected — no response was received before the 15-minute deadline.`
      : `Your client meeting "${pb.title}" request was rejected by ${rejectingUserEmail}. The requested time slot remains occupied.`

    await sendNotification({
      toEmail:   pb.ownerEmail,
      toUid:     pb.ownerUid ?? '',
      fromEmail: rejectingUserEmail,
      type:      'priority_rejected',
      message,
      bookingId: priorityBookingId,
    })

    await logHistory({
      bookingId:        priorityBookingId,
      bookingTitle:     pb.title,
      action:           'rejected',
      performedBy:      rejectingUserEmail,
      performedByEmail: rejectingUserEmail,
      meetingType:      'client',
      clientName:       pb.clientName ?? '',
      room:             pb.room,
      date:             pb.date,
      startMinutes:     pb.startMinutes,
      endMinutes:       pb.endMinutes,
      reason:           autoRejectReason ?? `Rejected by ${rejectingUserEmail}`,
    })
  }, [sendNotification, logHistory])

  // Self-cancellation edge case: when a booking is deleted, check if it was
  // the last conflict blocking a pending priority request. If so, auto-approve.
  const checkAndAutoApprovePriority = useCallback(async (deletedBookingId) => {
    const affected = bookingsRef.current.filter(b =>
      b.status === 'pending_priority_approval' &&
      Array.isArray(b.conflictsWithIds) &&
      b.conflictsWithIds.includes(deletedBookingId)
    )
    if (!affected.length) return

    const batch       = writeBatch(db)
    const autoApproved = []

    for (const pb of affected) {
      const resolved = [...(pb.approvedConflictIds ?? []), deletedBookingId]
      const allDone  = pb.conflictsWithIds.every(id => resolved.includes(id))

      if (allDone) {
        batch.update(doc(db, 'bookings', pb.id), {
          status:              'approved',
          approvedAt:          serverTimestamp(),
          approvedConflictIds: resolved,
          conflictsWithIds:    [],
        })
        // Cancel any remaining active conflicting meetings (e.g. those that
        // explicitly approved but weren't yet cancelled)
        for (const cId of pb.conflictsWithIds) {
          if (cId === deletedBookingId) continue
          const existing = bookingsRef.current.find(b => b.id === cId && b.status === 'approved')
          if (existing) {
            const stillOverlaps = existing.date === pb.date &&
              existing.startMinutes < pb.endMinutes &&
              existing.endMinutes > pb.startMinutes
            if (stillOverlaps) {
              batch.update(doc(db, 'bookings', cId), {
                status:                'cancelled',
                cancelledAt:           serverTimestamp(),
                cancelledByPriorityId: pb.id,
              })
            }
          }
        }
        autoApproved.push(pb)
      } else {
        batch.update(doc(db, 'bookings', pb.id), { approvedConflictIds: resolved })
      }
    }

    await batch.commit()

    for (const pb of autoApproved) {
      await sendNotification({
        toEmail:   pb.ownerEmail,
        toUid:     pb.ownerUid ?? '',
        type:      'meeting_approved',
        message:   `Your client meeting "${pb.title}" has been approved — all conflicting meetings have been resolved.`,
        bookingId: pb.id,
      })
      await logHistory({
        bookingId:    pb.id,
        bookingTitle: pb.title,
        action:       'approved',
        room:         pb.room,
        date:         pb.date,
        startMinutes: pb.startMinutes,
        endMinutes:   pb.endMinutes,
        reason:       'Auto-approved: all conflicting meetings resolved',
      })
    }
  }, [sendNotification, logHistory])

  // Auto-reject pending_priority_approval requests 15 minutes before their
  // start time to prevent deadlocks when owners fail to respond.
  useEffect(() => {
    if (!firebaseUser) return
    const checkTimeouts = async () => {
      const nowMs    = Date.now()
      const deadline = 15 * 60 * 1000
      const expired  = bookingsRef.current.filter(b => {
        if (b.status !== 'pending_priority_approval') return false
        const parts = (b.date || '').split('-').map(Number)
        if (parts.length < 3 || !parts[0]) return false
        const startMs = new Date(parts[0], parts[1] - 1, parts[2], 0, b.startMinutes ?? 0).getTime()
        return nowMs >= startMs - deadline
      })
      for (const pb of expired) {
        await rejectPriorityRequest(pb.id, 'system', 'Auto-rejected: approval deadline passed (15 min before meeting start)')
      }
    }
    const id = setInterval(checkTimeouts, 60_000)
    checkTimeouts()
    return () => clearInterval(id)
  }, [firebaseUser?.uid, rejectPriorityRequest])

  // ── Booking CRUD ──────────────────────────────────────────────────────────

  // Delete a booking. Triggers self-cancellation detection for any pending
  // priority requests that listed this booking as a conflict.
  const deleteBooking = useCallback(async (id) => {
    await deleteDoc(doc(db, 'bookings', id))
    await checkAndAutoApprovePriority(id)
  }, [checkAndAutoApprovePriority])

  // Delete a booking with a mandatory reason (used from Profile "My Meetings").
  // Also triggers self-cancellation detection.
  const deleteBookingWithReason = useCallback(async (booking, reason) => {
    await deleteDoc(doc(db, 'bookings', booking.id))

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

    await checkAndAutoApprovePriority(booking.id)
  }, [logHistory, checkAndAutoApprovePriority])

  // Reschedule a booking to a new slot.
  // Note: rescheduling alone is NOT an approval action — owners must still
  // explicitly approve or reject any pending priority requests via their inbox.
  const rescheduleBooking = useCallback(async (booking, newData) => {
    const batch = writeBatch(db)
    batch.update(doc(db, 'bookings', booking.id), {
      ...newData,
      status:            'rescheduled',
      rescheduledAt:     serverTimestamp(),
      priorityRequestId: null,
    })
    await batch.commit()

    // Auto-dismiss any priority_request notification for this booking since the
    // user has already taken action on the conflicting slot
    const prNotif = notificationsRef.current.find(n =>
      n.type === 'priority_request' && n.bookingId === booking.id && !n.read
    )
    if (prNotif?.id) await updateDoc(doc(db, 'notifications', prNotif.id), { read: true })

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
  }, [logHistory])

  // Admin forcefully removes a booking that conflicts with a pending priority
  // request. Deletion triggers checkAndAutoApprovePriority automatically.
  const adminOverrideApprove = useCallback(async (conflictingBooking, clientBooking) => {
    await deleteDoc(doc(db, 'bookings', conflictingBooking.id))

    await sendNotification({
      toEmail:          conflictingBooking.ownerEmail,
      toUid:            conflictingBooking.ownerUid ?? '',
      fromEmail:        'admin',
      fromName:         'Admin',
      type:             'admin_override',
      message:          'Your meeting has been removed by the admin to accommodate a priority client meeting.',
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
      reason:           'Admin override — removed to accommodate a priority client meeting.',
    })

    await checkAndAutoApprovePriority(conflictingBooking.id)
  }, [sendNotification, logHistory, checkAndAutoApprovePriority, firebaseUser?.email])

  // Owner withdraws their own pending_priority_approval meeting before consensus.
  // Existing confirmed meetings are untouched (they were never altered).
  const cancelClientBooking = useCallback(async (booking) => {
    const batch = writeBatch(db)
    batch.delete(doc(db, 'bookings', booking.id))
    await batch.commit()

    // Notify all approvers that the request has been withdrawn
    const conflictIds = Array.isArray(booking.conflictsWithIds)
      ? booking.conflictsWithIds
      : booking.conflictsWithId ? [booking.conflictsWithId] : []
    const approverEmails = [...new Set(
      bookingsRef.current
        .filter(b => conflictIds.includes(b.id))
        .map(b => b.ownerEmail)
        .filter(Boolean)
    )]
    for (const email of approverEmails) {
      await sendNotification({
        toEmail:          email,
        fromEmail:        booking.ownerEmail,
        fromName:         booking.coordinator,
        type:             'priority_withdrawn',
        message:          `The priority client meeting request "${booking.title}" has been withdrawn by ${booking.coordinator}. No action needed from you.`,
        bookingId:        booking.id,
        relatedBookingId: booking.id,
      })
    }

    await logHistory({
      bookingId:        booking.id,
      bookingTitle:     booking.title,
      action:           'withdrawn',
      performedBy:      booking.coordinator,
      performedByEmail: booking.ownerEmail,
      meetingType:      'client',
      clientName:       booking.clientName ?? '',
      room:             booking.room,
      date:             booking.date,
      startMinutes:     booking.startMinutes,
      endMinutes:       booking.endMinutes,
      reason:           'Priority request withdrawn by owner before approval',
    })
  }, [logHistory, sendNotification])

  const markNotificationRead = useCallback(async (notifId) => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true })
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.read)
    await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })))
  }, [notifications])

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

  const safePage    = (page === 'admin' && user.role !== 'admin') ? 'dashboard' : page
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
        approvePriorityRequest={approvePriorityRequest}
        rejectPriorityRequest={rejectPriorityRequest}
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
