'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Lock, CheckCircle, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileStatus, setProfileStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username || '')
        setFullName(profile.full_name || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileStatus(null)

    if (!username.trim()) {
      setProfileStatus({ type: 'error', message: 'Username cannot be empty.' })
      return
    }

    setProfileLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .neq('id', user.id)
      .single()

    if (existing) {
      setProfileStatus({ type: 'error', message: 'That username is already taken.' })
      setProfileLoading(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim(), full_name: fullName.trim() || null })
      .eq('id', user.id)

    if (error) {
      setProfileStatus({ type: 'error', message: error.message })
    } else {
      await supabase.auth.updateUser({ data: { username: username.trim() } })
      setProfileStatus({ type: 'success', message: 'Profile updated successfully.' })
    }
    setProfileLoading(false)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordStatus(null)

    if (!currentPassword) {
      setPasswordStatus({ type: 'error', message: 'Please enter your current password.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match.' })
      return
    }

    setPasswordLoading(true)
    const supabase = createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (signInError) {
      setPasswordStatus({ type: 'error', message: 'Current password is incorrect.' })
      setPasswordLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPasswordStatus({ type: 'error', message: error.message })
    } else {
      setPasswordStatus({ type: 'success', message: 'Password changed successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setPasswordLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const inputClass = 'w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white dark:bg-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400'
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Manage your profile and account security</p>
      </div>

      {/* Profile section */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <User size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Profile</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Update your username and display name</p>
          </div>
        </div>

        {profileStatus && (
          <div className={`flex items-center gap-2 rounded-lg p-3 mb-4 text-sm ${
            profileStatus.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-600'
          }`}>
            {profileStatus.type === 'success'
              ? <CheckCircle size={16} className="shrink-0" />
              : <AlertCircle size={16} className="shrink-0" />}
            {profileStatus.message}
          </div>
        )}

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-400 bg-slate-50 dark:bg-slate-700/50 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed here. Contact support if needed.</p>
          </div>

          <div>
            <label className={labelClass}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className={inputClass} placeholder="johndoe" />
          </div>

          <div>
            <label className={labelClass}>Display name <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="John Doe" />
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={profileLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors">
              {profileLoading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Password section */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <Lock size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Change Password</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Choose a strong password you don&apos;t use elsewhere</p>
          </div>
        </div>

        {passwordStatus && (
          <div className={`flex items-center gap-2 rounded-lg p-3 mb-4 text-sm ${
            passwordStatus.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-600'
          }`}>
            {passwordStatus.type === 'success'
              ? <CheckCircle size={16} className="shrink-0" />
              : <AlertCircle size={16} className="shrink-0" />}
            {passwordStatus.message}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className={labelClass}>Current password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className={inputClass} placeholder="••••••••" />
          </div>

          <div>
            <label className={labelClass}>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className={inputClass} placeholder="••••••••" />
            <p className="text-xs text-slate-400 mt-1">Minimum 8 characters.</p>
          </div>

          <div>
            <label className={labelClass}>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={inputClass} placeholder="••••••••" />
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={passwordLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors">
              {passwordLoading ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
