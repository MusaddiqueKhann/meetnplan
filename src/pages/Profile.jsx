import { useState } from 'react'
import {
  ArrowLeft, Eye, EyeOff, Loader2, Trash2, Lock,
  Building2, Mail, User, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import {
  updatePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  deleteUser as fbDeleteUser,
} from 'firebase/auth'
import { doc, deleteDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white ' +
  'focus:outline-none focus:border-black focus:ring-1 focus:ring-black ' +
  'transition-all placeholder:text-neutral-300'

function authErrMsg(code) {
  const map = {
    'auth/wrong-password':        'Current password is incorrect.',
    'auth/invalid-credential':    'Current password is incorrect.',
    'auth/too-many-requests':     'Too many attempts. Please try again later.',
    'auth/requires-recent-login': 'Please log out and log back in first.',
  }
  return map[code] || 'Something went wrong. Please try again.'
}

export default function Profile({
  onNavigate, bookings = [], deleteBooking, user,
}) {
  // Password change
  const [curPass,     setCurPass]     = useState('')
  const [newPass,     setNewPass]     = useState('')
  const [confPass,    setConfPass]    = useState('')
  const [showCur,     setShowCur]     = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConf,    setShowConf]    = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [passError,   setPassError]   = useState('')
  const [passDone,    setPassDone]    = useState(false)

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletePass,    setDeletePass]    = useState('')
  const [showDelPass,   setShowDelPass]   = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState('')

  async function handleChangePassword(e) {
    e.preventDefault()
    setPassError('')
    setPassDone(false)
    if (newPass.length < 6)  return setPassError('New password must be at least 6 characters.')
    if (newPass !== confPass) return setPassError('Passwords do not match.')
    setPassLoading(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, curPass)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPass)
      setCurPass(''); setNewPass(''); setConfPass('')
      setPassDone(true)
    } catch (err) {
      setPassError(authErrMsg(err.code))
    } finally {
      setPassLoading(false)
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault()
    setDeleteError('')
    setDeleteLoading(true)
    try {
      if (user.isGoogleUser) {
        await reauthenticateWithPopup(auth.currentUser, googleProvider)
      } else {
        const credential = EmailAuthProvider.credential(user.email, deletePass)
        await reauthenticateWithCredential(auth.currentUser, credential)
      }
      const myMeetings = bookings.filter(b => b.ownerEmail === user.email)
      await Promise.all(myMeetings.map(b => deleteBooking(b.id)))
      await deleteDoc(doc(db, 'users', user.uid))
      await fbDeleteUser(auth.currentUser)
    } catch (err) {
      setDeleteError(authErrMsg(err.code))
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => onNavigate('dashboard')}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-neutral-100 transition-colors">
          <ArrowLeft size={16} className="text-neutral-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-black tracking-tight">My Profile</h1>
          <p className="text-sm text-neutral-400">Account settings and preferences</p>
        </div>
      </div>

      {/* User info card */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-black flex items-center justify-center flex-shrink-0 overflow-hidden">
          {user.photoURL
            ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-white">{user.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
          }
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <User size={13} className="text-neutral-300" />
            <span className="text-[13px] font-semibold text-black">{user.name}</span>
            {user.role === 'admin' && (
              <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold rounded-full uppercase tracking-wide">Admin</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Mail size={13} className="text-neutral-300" />
            <span className="text-[13px] text-neutral-500">{user.email}</span>
          </div>
          {user.company && (
            <div className="flex items-center gap-2">
              <Building2 size={13} className="text-neutral-300" />
              <span className="text-[13px] text-neutral-500">{user.company}</span>
            </div>
          )}
          {user.isGoogleUser && (
            <span className="text-[11px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full w-fit">Signed in with Google</span>
          )}
        </div>
      </div>

      {/* Change Password */}
      {!user.isGoogleUser && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-2">
            <Lock size={15} className="text-neutral-400" />
            <h2 className="text-[13px] font-bold text-black">Change Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="px-6 py-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Current Password', val: curPass,  set: setCurPass,  show: showCur,  toggle: () => setShowCur(v => !v)  },
                { label: 'New Password',      val: newPass,  set: setNewPass,  show: showNew,  toggle: () => setShowNew(v => !v)  },
                { label: 'Confirm Password',  val: confPass, set: setConfPass, show: showConf, toggle: () => setShowConf(v => !v) },
              ].map(({ label, val, set, show, toggle }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{label}</label>
                  <div className="relative">
                    <input type={show ? 'text' : 'password'} value={val}
                      onChange={e => set(e.target.value)} className={inputCls + ' pr-10'} placeholder="••••••••" required />
                    <button type="button" onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-black transition-colors">
                      {show ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {passError && <p className="text-xs text-red-500">{passError}</p>}
            {passDone && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle2 size={13} /> Password updated successfully.
              </div>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={passLoading}
                className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-black rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {passLoading ? <Loader2 size={13} className="animate-spin" /> : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Google users */}
      {user.isGoogleUser && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 flex items-center gap-4">
          <Lock size={18} className="text-neutral-300 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-black">Password managed by Google</p>
            <p className="text-[12px] text-neutral-400 mt-0.5">Manage your password through your Google account settings.</p>
          </div>
        </div>
      )}

      {/* Delete Account */}
      <div className="bg-white border border-red-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-400" />
          <h2 className="text-[13px] font-bold text-red-500">Delete Account</h2>
        </div>
        <div className="px-6 py-5">
          {!deleteConfirm ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <p className="text-[13px] text-neutral-500">Permanently removes your account and all your meetings. This cannot be undone.</p>
              <button onClick={() => setDeleteConfirm(true)}
                className="self-start sm:self-auto flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 active:scale-[0.98] transition-all">
                <Trash2 size={13} /> Delete Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4">
              <p className="text-[13px] text-neutral-600 font-medium">
                {user.isGoogleUser
                  ? 'Click below to re-authenticate with Google and confirm deletion.'
                  : 'Enter your password to confirm account deletion.'}
              </p>
              {!user.isGoogleUser && (
                <div className="relative max-w-xs">
                  <input type={showDelPass ? 'text' : 'password'} value={deletePass}
                    onChange={e => setDeletePass(e.target.value)} className={inputCls + ' pr-10'} placeholder="Your password" required />
                  <button type="button" onClick={() => setShowDelPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-black transition-colors">
                    {showDelPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )}
              {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={deleteLoading}
                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {deleteLoading ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> Confirm Delete</>}
                </button>
                <button type="button" onClick={() => { setDeleteConfirm(false); setDeletePass(''); setDeleteError('') }}
                  className="px-5 py-2.5 text-[13px] font-semibold text-neutral-500 rounded-xl hover:bg-neutral-100 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
