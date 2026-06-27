import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/context/LanguageContext'
import { authApi, settingsApi } from '@/services/api'
import { toast } from 'react-hot-toast'
import { Camera, Check, Globe, Moon, Bell, User, CreditCard, Key, Lock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveAvatarUrl } from '@/utils/mediaUrl'
import { auth } from '@/firebase/config'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import SubscriptionModal from '@/components/common/SubscriptionModal'

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const fileInputRef = useRef(null)
  
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ 
    name: user?.name || '', 
    email: user?.email || '',
    notifications: user?.notifications || {
      bookings: true,
      analytics: true,
      documents: true
    }
  })

  const [passwordForm, setPasswordForm] = useState({ 
    oldPassword: '', 
    newPassword: '', 
    confirmPassword: '' 
  })

  const [pricePerCent, setPricePerCent] = useState('10000')
  const [avatarProgress, setAvatarProgress] = useState(0)
  const [showSubscription, setShowSubscription] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState({})

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await settingsApi.getSettings()
        if (data.settings?.pricePerCent) {
          setPricePerCent(data.settings.pricePerCent)
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err)
      }
    }
    fetchSettings()
  }, [])

  const updatePriceSettings = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await settingsApi.updateSetting('pricePerCent', pricePerCent)
      toast.success('Price per Cent updated successfully!')
    } catch (err) {
      toast.error('Failed to update price settings')
    } finally {
      setSaving(false)
    }
  }

  const updateProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await authApi.updateProfile({ name: form.name, email: form.email })
      await authApi.updateNotifications(form.notifications)
      await refreshUser()
      toast.success('Profile updated successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const updatePassword = async (e) => {
    e.preventDefault()
    const errors = {}
    if (!passwordForm.oldPassword) errors.oldPassword = 'Current password is required'
    if (passwordForm.newPassword.length < 8) errors.newPassword = 'Minimum 8 characters required'
    if (!/[A-Z]/.test(passwordForm.newPassword)) errors.newPassword = 'Include at least 1 uppercase letter'
    if (!/[0-9]/.test(passwordForm.newPassword)) errors.newPassword = 'Include at least 1 number'
    if (passwordForm.newPassword !== passwordForm.confirmPassword) errors.confirmPassword = 'Passwords must match'
    setPasswordErrors(errors)
    if (Object.keys(errors).length) return

    setSaving(true)
    try {
      const firebaseUser = auth.currentUser
      if (!firebaseUser?.email) throw new Error('Not signed in with Firebase')
      const credential = EmailAuthProvider.credential(firebaseUser.email, passwordForm.oldPassword)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updatePassword(firebaseUser, passwordForm.newPassword)
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordErrors({})
      toast.success('Password changed successfully!')
    } catch (err) {
      const code = err.code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Incorrect current password')
      } else if (code === 'auth/weak-password') {
        toast.error('Password is too weak')
      } else {
        toast.error(err.message || 'Failed to update password')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setSaving(true)
    setAvatarProgress(0)
    try {
      const { data } = await authApi.uploadAvatar(file, setAvatarProgress)
      const avatarUrl = data?.data?.avatarUrl || data?.avatarUrl
      if (avatarUrl) {
        const updated = { ...user, avatar: avatarUrl }
        localStorage.setItem('landlink_user', JSON.stringify(updated))
      }
      await refreshUser()
      toast.success('Profile picture updated!')
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message || err.message
      if (status === 403) toast.error('Upload not permitted. Check your account permissions.')
      else if (status === 429) toast.error(msg || 'Too many uploads. Please wait and try again.')
      else toast.error(msg || 'Failed to upload image')
    } finally {
      setSaving(false)
      setAvatarProgress(0)
    }
  }

  const avatarSrc = resolveAvatarUrl(user?.avatar)

  return (
    <div className="p-1 md:p-6 space-y-8 pb-12 page-enter min-w-0">
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <h1 className="page-title text-text tracking-tight">{t('settings')}</h1>
          <p className="text-sm text-muted font-medium mt-1">{t('profile')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Section */}
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
                <div className="relative group">
                  <div 
                    onClick={handleAvatarClick}
                    className="w-32 h-32 rounded-[40px] bg-bg border-2 border-dashed border-border/60 flex items-center justify-center cursor-pointer overflow-hidden group-hover:border-primary transition-all"
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-muted" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white w-8 h-8" />
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl font-black text-text mb-1">{user?.name}</h3>
                  <p className="text-sm text-muted font-bold mb-4">{user?.email}</p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/10">Owner</span>
                    <span className="px-3 py-1 bg-emerald/10 text-emerald text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald/10">Verified</span>
                  </div>
                </div>
              </div>
              {avatarProgress > 0 && avatarProgress < 100 && (
                <div className="mb-6 w-full h-2 bg-border/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${avatarProgress}%` }} />
                </div>
              )}
              <form onSubmit={updateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input 
                    label="Full Name" 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    className="h-12 bg-bg border-border/40 focus:border-primary rounded-2xl px-5 font-bold"
                  />
                  <Input 
                    label="Email Address" 
                    type="email" 
                    value={form.email} 
                    onChange={e => setForm({...form, email: e.target.value})} 
                    className="h-12 bg-bg border-border/40 focus:border-primary rounded-2xl px-5 font-bold"
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={saving} className="h-11 px-8 font-bold shadow-lg shadow-primary/20">
                    {saving ? '...' : t('save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Pricing Settings Section */}
          <Card className="border-border/60 shadow-sm rounded-3xl overflow-hidden bg-card">
            <div className="p-6 border-b border-border/40 bg-bg/20">
              <CardTitle className="flex items-center gap-3 text-text font-black">
                <div className="p-2 bg-emerald/10 rounded-xl">
                  <CreditCard className="w-5 h-5 text-emerald" />
                </div>
                Global Pricing Rules
              </CardTitle>
            </div>
            <CardContent className="p-8">
              <form onSubmit={updatePriceSettings} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted uppercase tracking-widest ml-1">Base Price per Cent (₹)</label>
                    <Input 
                      type="number" 
                      value={pricePerCent} 
                      onChange={e => setPricePerCent(e.target.value)} 
                      className="h-12 bg-bg border-border/40 focus:border-primary rounded-2xl px-5 font-bold"
                    />
                    <p className="text-xs text-muted font-medium ml-1">Used to auto-calculate price when extracting plots from PDF table.</p>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-border/30">
                  <Button 
                    type="submit" 
                    disabled={saving} 
                    className="h-12 px-10 font-black bg-primary hover:bg-primary-dark text-white shadow-xl shadow-primary/20 rounded-2xl group transition-all"
                  >
                    {saving ? '...' : 'Update Pricing'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security / Password Section */}
          <Card className="border-border/60 shadow-sm rounded-3xl overflow-hidden bg-card">
            <div className="p-6 border-b border-border/40 bg-bg/20">
              <CardTitle className="flex items-center gap-3 text-text font-black">
                <div className="p-2 bg-amber/10 rounded-xl">
                  <Lock className="w-5 h-5 text-amber" />
                </div>
                Security & Authentication
              </CardTitle>
            </div>
            <CardContent className="p-8">
              <form onSubmit={updatePassword} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted uppercase tracking-widest ml-1">Current Password</label>
                    <div className="relative">
                      <Input 
                        type="password" 
                        placeholder="••••••••"
                        value={passwordForm.oldPassword} 
                        onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})} 
                        className="h-12 bg-bg border-border/40 focus:border-primary rounded-2xl px-5 font-bold"
                      />
                      <Key className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/40" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted uppercase tracking-widest ml-1">New Password</label>
                    <Input 
                      type="password" 
                      placeholder="••••••••"
                      value={passwordForm.newPassword} 
                      onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} 
                      className="h-12 bg-bg border-border/40 focus:border-primary rounded-2xl px-5 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted uppercase tracking-widest ml-1">Confirm New Password</label>
                    <div className="relative">
                      <Input 
                        type="password" 
                        placeholder="••••••••"
                        value={passwordForm.confirmPassword} 
                        onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} 
                        className={cn(
                          "h-12 bg-bg border-border/40 focus:border-primary rounded-2xl px-5 font-bold transition-all",
                          passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && "border-red ring-1 ring-red/20"
                        )}
                      />
                      {passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword && (
                        <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald" />
                      )}
                    </div>
                    {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                      <p className="text-[10px] text-red font-black uppercase tracking-widest mt-1 ml-1">Passwords must match</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-border/30">
                  <Button 
                    type="submit" 
                    disabled={saving} 
                    className="h-12 px-10 font-black bg-primary hover:bg-primary-dark text-white shadow-xl shadow-primary/20 rounded-2xl group transition-all"
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Appearance Section */}
          <Card className="border-border/60 shadow-sm rounded-3xl overflow-hidden bg-card">
            <CardContent className="p-8">
              <CardTitle className="mb-6 flex items-center gap-3 text-text font-black">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Moon className="w-5 h-5 text-primary" />
                </div>
                {t('theme')}
              </CardTitle>
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-bg rounded-2xl border border-border/50 mb-6">
                {['light', 'dark', 'system'].map((t) => (
                  <button 
                    key={t} 
                    onClick={() => setTheme(t)}
                    className={cn(
                      "py-2.5 text-[11px] font-black rounded-xl capitalize transition-all tracking-tight",
                      theme === t 
                        ? "bg-card text-primary shadow-sm ring-1 ring-border/50" 
                        : "text-muted hover:text-text hover:bg-card/50"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              
              <CardTitle className="mb-4 flex items-center gap-3 text-text font-black border-t border-border/40 pt-6">
                <div className="p-2 bg-purple/10 rounded-xl">
                  <Globe className="w-5 h-5 text-purple" />
                </div>
                {t('language')}
              </CardTitle>
              <select 
                value={language}
                onChange={e => {
                  const val = e.target.value
                  setLanguage(val)
                  toast.success(`Language set to ${val}`)
                }}
                className="w-full h-12 px-4 rounded-2xl border border-border/40 bg-bg text-sm font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all hover:border-border"
              >
                <option value="English">English (Global)</option>
                <option value="Tamil">Tamil (தமிழ்)</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
              </select>
            </CardContent>
          </Card>

          {/* Preferences Section */}
          <Card className="border-border/60 shadow-sm rounded-3xl overflow-hidden bg-card">
            <CardContent className="p-8">
              <CardTitle className="mb-6 flex items-center gap-3 text-text font-black">
                <div className="p-2 bg-emerald/10 rounded-xl">
                  <Bell className="w-5 h-5 text-emerald" />
                </div>
                Notifications
              </CardTitle>
              <div className="space-y-4">
                {Object.keys(form.notifications).map((key) => (
                  <div key={key} className="flex items-center justify-between group">
                    <span className="text-sm font-bold capitalize text-text group-hover:text-primary transition-colors">{key} Alerts</span>
                    <button 
                      onClick={() => setForm({ ...form, notifications: { ...form.notifications, [key]: !form.notifications[key] } })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative ring-2 ring-transparent group-hover:ring-primary/10",
                        form.notifications[key] ? 'bg-primary' : 'bg-border/60'
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all",
                        form.notifications[key] ? 'right-1' : 'left-1'
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Membership Card */}
          <Card className="border-border/60 shadow-sm rounded-3xl overflow-hidden bg-card">
            <CardContent className="p-8">
              <CardTitle className="mb-6 flex items-center gap-3 text-text font-black">
                <div className="p-2 bg-amber/10 rounded-xl">
                  <CreditCard className="w-5 h-5 text-amber" />
                </div>
                Membership
              </CardTitle>
              <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 relative overflow-hidden group mb-4">
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-2">Current Tier</p>
                <p className="text-2xl font-black text-text capitalize">{user?.plan || 'Standard'}</p>
                <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
              </div>
              <Button variant="outline" onClick={() => setShowSubscription(true)} className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5">
                Manage Subscription
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <SubscriptionModal open={showSubscription} onClose={() => setShowSubscription(false)} />
    </div>
  )
}
