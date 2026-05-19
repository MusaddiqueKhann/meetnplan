import { useState, useEffect } from 'react'
import { ArrowRight, ArrowLeft, Eye, EyeOff, Loader2, Calendar, Users, Zap, AlertCircle, Mail } from 'lucide-react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

const DEFAULT_COMPANIES = ['Wolfhead', 'CloudGate', 'CodeLtd']

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-neutral-50 text-neutral-800 ' +
  'focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-black/[0.06] focus:bg-white ' +
  'transition-all placeholder:text-neutral-300'

function friendlyError(code) {
  const map = {
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect email or password.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/user-disabled':          'This account has been disabled.',
  }
  return map[code] || 'Something went wrong. Please try again.'
}

export default function SplashPage({ needsGoogleProfile = false, googleUser = null, companies: companiesProp }) {
  const [view,      setView]      = useState('login')
  const [loading,   setLoading]   = useState(false)
  const [companies, setCompanies] = useState(companiesProp ?? DEFAULT_COMPANIES)

  useEffect(() => {
    if (companiesProp) return
    getDoc(doc(db, 'settings', 'config')).then(snap => {
      const list = snap.data()?.companies
      if (Array.isArray(list) && list.length > 0) setCompanies(list)
    }).catch(() => {})
  }, [])

  // login
  const [lEmail, setLEmail] = useState('')
  const [lPass,  setLPass]  = useState('')
  const [showLP, setShowLP] = useState(false)
  const [lError, setLError] = useState('')

  // signup
  const [sName,          setSName]          = useState('')
  const [sEmail,         setSEmail]         = useState('')
  const [sCompany,       setSCompany]       = useState('')
  const [sCompanyCustom, setSCompanyCustom] = useState('')
  const [sPass,          setSPass]          = useState('')
  const [showSP,         setShowSP]         = useState(false)
  const [sError,         setSError]         = useState('')

  // forgot
  const [fEmail, setFEmail] = useState('')
  const [fError, setFError] = useState('')
  const [fDone,  setFDone]  = useState(false)

  // complete profile (new Google user)
  const [cpCompany, setCpCompany] = useState('')
  const [cpCustom,  setCpCustom]  = useState('')
  const [cpError,   setCpError]   = useState('')

  useEffect(() => {
    if (needsGoogleProfile) setView('complete-profile')
  }, [needsGoogleProfile])

  async function handleLogin(e) {
    e.preventDefault()
    setLError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, lEmail.trim(), lPass)
      // onAuthStateChanged in App.jsx handles routing automatically
    } catch (err) {
      setLError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      // App.jsx onAuthStateChanged + profile listener handles routing
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setLError(friendlyError(err.code))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setSError('')
    if (!sName.trim()) return setSError('Please enter your full name.')
    if (!sCompany)     return setSError('Please select your company.')
    const company = sCompany === 'other' ? sCompanyCustom.trim() : sCompany
    if (!company)      return setSError('Please enter your company name.')
    if (sPass.length < 6) return setSError('Password must be at least 6 characters.')
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, sEmail.trim(), sPass)
      await setDoc(doc(db, 'users', cred.user.uid), {
        name:      sName.trim(),
        company,
        role:      'user',
        createdAt: new Date().toISOString(),
      })
      // App.jsx picks up auth state + profile automatically
    } catch (err) {
      setSError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setFError('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, fEmail.trim())
      setFDone(true)
    } catch (err) {
      setFError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteProfile(e) {
    e.preventDefault()
    setCpError('')
    if (!cpCompany) return setCpError('Please select your company.')
    const company = cpCompany === 'other' ? cpCustom.trim() : cpCompany
    if (!company)   return setCpError('Please enter your company name.')
    setLoading(true)
    try {
      await setDoc(doc(db, 'users', googleUser.uid), {
        name:      googleUser.displayName || 'User',
        company,
        role:      'user',
        createdAt: new Date().toISOString(),
      })
      // App.jsx onSnapshot on profile doc detects the new doc → shows main app
    } catch {
      setCpError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const headings = {
    login:              { title: 'Welcome back',          sub: 'Sign in to your workspace' },
    signup:             { title: 'Create account',        sub: "Join your team's workspace" },
    forgot:             { title: fDone ? 'Email sent'   : 'Reset password',
                          sub:   fDone ? 'Check your inbox for the link' : 'Enter your registered email' },
    'complete-profile': { title: 'Complete your profile', sub: 'One last step to get started' },
  }
  const { title, sub } = headings[view] ?? headings.login

  return (
    <div className="w-full min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col w-[52%] bg-[#080808] px-16 py-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute -top-40 -left-20 w-[520px] h-[520px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 68%)' }} />
        <div className="absolute -bottom-32 -right-20 w-[420px] h-[420px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute top-1/2 right-0 w-[420px] h-[420px] rounded-full border border-white/[0.05] translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-[260px] h-[260px] rounded-full border border-white/[0.04] translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-white/[0.12] flex items-center justify-center">
            <span className="text-[11px] font-bold text-white/80">M</span>
          </div>
          <span className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.35em]">MeetNPlan</span>
        </div>

        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center relative z-10">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.5em] mb-6">Workspace Platform</p>
          <h1 className="font-extrabold leading-[0.83] text-white mb-7" style={{ fontSize: 'clamp(72px,7.5vw,108px)', letterSpacing: '-5px' }}>
            MEET<span className="text-transparent" style={{ WebkitTextStroke: '2px rgba(255,255,255,0.18)' }}>N</span>PLAN
          </h1>
          <div className="w-14 h-px mb-8" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.22), transparent)' }} />
          <div className="flex flex-col gap-5 mb-10">
            {[
              { Icon: Calendar, label: 'Smart Scheduling', desc: 'Plan and manage every meeting effortlessly' },
              { Icon: Users,    label: 'Team Sync',        desc: 'Stay aligned across your whole organization' },
              { Icon: Zap,      label: 'Always On Track',  desc: 'Never miss a meeting or an important deadline' },
            ].map(({ Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3.5">
                <div className="mt-0.5 w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.09] flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-white/45" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white/60 leading-tight">{label}</p>
                  <p className="text-[11px] text-white/25 leading-snug mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-white/18 uppercase tracking-widest mr-1">For</span>
            {['WolfHead', 'CodeLTD', 'CloudGate'].map(c => (
              <span key={c} className="px-2.5 py-1 rounded-full border text-[11px] font-medium text-white/35"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white/18" />
          <span className="text-[11px] text-white/18 tracking-wide">Secured by Firebase Authentication</span>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 sm:px-10 py-10 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.032) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        {/* Mobile logo */}
        <div className="lg:hidden mb-10 text-center relative z-10">
          <h1 className="text-5xl font-extrabold tracking-[-3px] text-black">
            MEET<span className="text-transparent" style={{ WebkitTextStroke: '2px #000' }}>N</span>PLAN
          </h1>
          <p className="text-[10px] text-neutral-400 mt-2 uppercase tracking-widest">Workspace Platform</p>
        </div>

        <div className="relative z-10 w-full max-w-[460px]">
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.08)] px-7 py-8">

            {/* Back button */}
            {view === 'forgot' && !fDone && (
              <button onClick={() => { setView('login'); setFEmail(''); setFError(''); setFDone(false) }}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-black transition-colors mb-5">
                <ArrowLeft size={13} /> Back to login
              </button>
            )}

            <div className="mb-6">
              <h2 className="text-[22px] font-bold text-black tracking-tight">{title}</h2>
              <p className="text-[13px] text-neutral-400 mt-1">{sub}</p>
            </div>

            {/* Login / Signup tabs */}
            {(view === 'login' || view === 'signup') && (
              <div className="flex bg-neutral-100 rounded-xl p-1 mb-6 gap-1">
                {['login', 'signup'].map(t => (
                  <button key={t} onClick={() => { setView(t); setLError(''); setSError('') }}
                    className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                      view === t
                        ? 'bg-white text-black shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                        : 'text-neutral-400 hover:text-neutral-600'
                    }`}>
                    {t === 'login' ? 'Log In' : 'Sign Up'}
                  </button>
                ))}
              </div>
            )}

            {/* ── LOGIN ── */}
            {view === 'login' && (
              <div className="flex flex-col gap-4">
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <Field label="Email">
                    <input type="email" placeholder="you@company.com" value={lEmail}
                      onChange={e => setLEmail(e.target.value)} className={inputCls} required />
                  </Field>
                  <Field label="Password" aside={
                    <button type="button" onClick={() => { setView('forgot'); setLError('') }}
                      className="text-[11px] text-neutral-400 hover:text-black transition-colors">
                      Forgot password?
                    </button>
                  }>
                    <PassInput value={lPass} onChange={e => setLPass(e.target.value)} show={showLP} onToggle={() => setShowLP(v => !v)} />
                  </Field>
                  {lError && <Err>{lError}</Err>}
                  <SubmitBtn loading={loading}>Enter Dashboard</SubmitBtn>
                </form>
                <Divider />
                <GoogleBtn loading={loading} onClick={handleGoogle} />
              </div>
            )}

            {/* ── SIGNUP ── */}
            {view === 'signup' && (
              <div className="flex flex-col gap-4">
                <form onSubmit={handleSignup} className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Full Name">
                      <input type="text" placeholder="Your name" value={sName}
                        onChange={e => setSName(e.target.value)} className={inputCls} required />
                    </Field>
                    <Field label="Company">
                      <select value={sCompany} onChange={e => { setSCompany(e.target.value); setSCompanyCustom('') }}
                        className={inputCls + ' cursor-pointer'} required>
                        <option value="" disabled>Select</option>
                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="other">Other</option>
                      </select>
                    </Field>
                  </div>
                  {sCompany === 'other' && (
                    <input type="text" placeholder="Enter your company name" value={sCompanyCustom}
                      onChange={e => setSCompanyCustom(e.target.value)} className={inputCls} required />
                  )}
                  <Field label="Email">
                    <input type="email" placeholder="you@company.com" value={sEmail}
                      onChange={e => setSEmail(e.target.value)} className={inputCls} required />
                  </Field>
                  <Field label="Password">
                    <PassInput value={sPass} onChange={e => setSPass(e.target.value)} show={showSP} onToggle={() => setShowSP(v => !v)} />
                  </Field>
                  {sError && <Err>{sError}</Err>}
                  <SubmitBtn loading={loading}>Create Account</SubmitBtn>
                </form>
                <Divider />
                <GoogleBtn loading={loading} onClick={handleGoogle} />
              </div>
            )}

            {/* ── FORGOT: email input ── */}
            {view === 'forgot' && !fDone && (
              <form onSubmit={handleForgot} className="flex flex-col gap-4">
                <Field label="Registered Email">
                  <input type="email" placeholder="you@company.com" value={fEmail}
                    onChange={e => setFEmail(e.target.value)} className={inputCls} required />
                </Field>
                {fError && <Err>{fError}</Err>}
                <SubmitBtn loading={loading}>Send Reset Link</SubmitBtn>
              </form>
            )}

            {/* ── FORGOT: success ── */}
            {view === 'forgot' && fDone && (
              <div className="flex flex-col items-center gap-5 text-center py-2">
                <div className="relative flex items-center justify-center">
                  <div className="w-[72px] h-[72px] rounded-full bg-neutral-100" />
                  <div className="absolute w-[72px] h-[72px] rounded-full border-2 border-black/[0.07] scale-[1.2]" />
                  <div className="absolute w-11 h-11 rounded-full bg-black flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.22)]">
                    <Mail size={19} className="text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <div>
                  <p className="text-[16px] font-bold text-black tracking-tight">Check your inbox</p>
                  <p className="text-[12px] text-neutral-400 mt-1.5 leading-relaxed">
                    We sent a password reset link to<br />
                    <span className="font-semibold text-neutral-600">{fEmail}</span>
                  </p>
                </div>
                <button onClick={() => { setView('login'); setFEmail(''); setFDone(false) }}
                  className="w-full flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-white bg-black rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
                  Back to Log In <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* ── COMPLETE PROFILE (new Google user) ── */}
            {view === 'complete-profile' && (
              <form onSubmit={handleCompleteProfile} className="flex flex-col gap-4">
                {googleUser && (
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                    {googleUser.photoURL ? (
                      <img src={googleUser.photoURL} alt="" className="w-9 h-9 rounded-full" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center">
                        <span className="text-[14px] font-bold text-white">
                          {(googleUser.displayName || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-[13px] font-semibold text-black">{googleUser.displayName || 'Google User'}</p>
                      <p className="text-[11px] text-neutral-400">{googleUser.email}</p>
                    </div>
                  </div>
                )}
                <Field label="Company">
                  <select value={cpCompany} onChange={e => { setCpCompany(e.target.value); setCpCustom('') }}
                    className={inputCls + ' cursor-pointer'} required>
                    <option value="" disabled>Select your company</option>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="other">Other</option>
                  </select>
                </Field>
                {cpCompany === 'other' && (
                  <input type="text" placeholder="Enter your company name" value={cpCustom}
                    onChange={e => setCpCustom(e.target.value)} className={inputCls} required />
                )}
                {cpError && <Err>{cpError}</Err>}
                <SubmitBtn loading={loading}>Enter Workspace</SubmitBtn>
              </form>
            )}

          </div>

          <p className="text-center text-[11px] text-neutral-300 mt-5 tracking-wide">
            MeetNPlan · Internal workspace · Restricted access
          </p>
        </div>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────
function Field({ label, aside, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{label}</label>
        {aside}
      </div>
      {children}
    </div>
  )
}

function PassInput({ show, onToggle, value, onChange }) {
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} placeholder="••••••••"
        value={value} onChange={onChange} className={inputCls + ' pr-11'} required />
      <button type="button" onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-600 transition-colors">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function SubmitBtn({ children, loading }) {
  return (
    <button type="submit" disabled={loading}
      className="mt-1 w-full flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-white bg-black rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.14)] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <>{children} <ArrowRight size={14} /></>}
    </button>
  )
}

function Err({ children }) {
  return (
    <div className="flex items-center gap-1.5 -mt-1.5">
      <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
      <p className="text-[12px] text-red-500">{children}</p>
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-neutral-100" />
      <span className="text-[11px] text-neutral-300 font-medium">or</span>
      <div className="flex-1 h-px bg-neutral-100" />
    </div>
  )
}

function GoogleBtn({ loading, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="w-full flex items-center justify-center gap-2.5 py-2.5 text-[13px] font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98] transition-all shadow-[0_1px_4px_rgba(0,0,0,0.06)] disabled:opacity-50 disabled:cursor-not-allowed">
      <svg width="16" height="16" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Continue with Google
    </button>
  )
}
