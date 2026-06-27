import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase/config'
import { Loader2 } from 'lucide-react'
import AnimatedBackground from '@/components/common/AnimatedBackground'
import { modalVariant } from '@/utils/animations'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const firebaseErrors = {
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/invalid-email': 'Invalid email address format.',
  'auth/weak-password': 'Password should be at least 8 characters.',
}

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('owner')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMsg, setResetMsg] = useState(null)

  const validate = () => {
    const errs = {}
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address'
    if (password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (!isLogin && !name.trim()) errs.name = 'Name is required'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return

    setLoading(true)
    try {
      let userCredential
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email.trim(), password)
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      }

      const firebaseIdToken = await userCredential.user.getIdToken()
      const { data } = await authApi.verifyToken({
        firebaseIdToken,
        ...(!isLogin && { name, role }),
      })

      login(data.token, data.user)
      navigate(data.user.role === 'broker' ? '/broker' : '/dashboard')
    } catch (err) {
      if (err.code) {
        setError(firebaseErrors[err.code] || err.message)
      } else {
        setError(err.response?.data?.message || 'Authentication failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (!EMAIL_RE.test(resetEmail.trim())) {
      setResetMsg({ type: 'error', text: 'Enter a valid email address' })
      return
    }
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim())
      setResetMsg({ type: 'success', text: 'Check your inbox for a reset link.' })
    } catch (err) {
      setResetMsg({ type: 'error', text: firebaseErrors[err.code] || err.message })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AnimatedBackground />

      <div className="w-full max-w-[480px] relative z-10">
        <Link to="/" className="flex items-center gap-3 justify-center mb-10">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
            style={{
              background: 'linear-gradient(135deg, #4F8EF7 0%, #7B5EA7 100%)',
              boxShadow: '0 0 30px rgba(79,142,247,0.4)',
            }}
          >
            L
          </div>
          <span className="font-bold text-2xl text-[#E8EAF0]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>LandLink</span>
        </Link>

        <div className="glass-card p-10 md:p-12">
          <div className="flex gap-1 p-1 mb-8 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(79,142,247,0.1)]">
            {[
              { id: true, label: 'Log In' },
              { id: false, label: 'Register' },
            ].map(({ id, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => { setIsLogin(id); setError(null); setFieldErrors({}) }}
                className={`auth-tab ${isLogin === id ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, x: isLogin ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 12 : -12 }}
              transition={{ duration: 0.25 }}
            >
              <h1 className="text-2xl font-bold text-center mb-1 text-[#E8EAF0]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h1>
              <p className="text-sm text-[#8892A4] text-center mb-8">
                {isLogin ? 'Sign in to manage your plot projects' : 'Start managing layouts and brokers for free'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div>
                    <Input label="Full name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
                    {fieldErrors.name && <p className="text-xs text-[#EF4444] mt-1">{fieldErrors.name}</p>}
                  </div>
                )}

                <div>
                  <Input label="Email address" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  {fieldErrors.email && <p className="text-xs text-[#EF4444] mt-1">{fieldErrors.email}</p>}
                </div>

                <div>
                  <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  {fieldErrors.password && <p className="text-xs text-[#EF4444] mt-1">{fieldErrors.password}</p>}
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setResetEmail(email); setResetMsg(null) }}
                      className="text-sm mt-2 hover:underline"
                      style={{ color: '#4F8EF7' }}
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>

                {!isLogin && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[#E8EAF0]">I am a</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['owner', 'broker'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`py-2.5 rounded-[10px] text-sm font-medium border transition-colors ${
                            role === r
                              ? 'border-[#4F8EF7] bg-[rgba(79,142,247,0.1)] text-[#4F8EF7]'
                              : 'border-[rgba(79,142,247,0.2)] text-[#8892A4]'
                          }`}
                        >
                          {r === 'owner' ? 'Land Owner' : 'Broker'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-[#EF4444] bg-[rgba(239,68,68,0.1)] p-3 rounded-lg border border-[rgba(239,68,68,0.2)]">
                    {error}
                  </p>
                )}

                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
                  {loading ? <><Loader2 className="animate-spin" size={16} /> Please wait...</> : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
              </form>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div variants={modalVariant} initial="hidden" animate="visible" exit="exit" className="glass-card p-8 w-full max-w-sm">
              <h2 className="text-lg font-bold text-[#E8EAF0] mb-4">Reset Password</h2>
              <form onSubmit={handleReset} className="space-y-4">
                <Input label="Email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                {resetMsg && (
                  <p className={`text-sm p-3 rounded-lg ${resetMsg.type === 'success' ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981]' : 'bg-[rgba(239,68,68,0.1)] text-[#EF4444]'}`}>
                    {resetMsg.text}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost flex-1" onClick={() => setShowForgot(false)}>Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Send Reset Link</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
