import { useState } from 'react'
import { motion } from 'framer-motion'
import type { TeamFormValues } from './StepTeamDetails'
import { FiCheck, FiEdit2, FiZap, FiUsers, FiMail, FiPhone, FiBook } from 'react-icons/fi'
import toast from 'react-hot-toast'

// ── Backend API URL ──────────────────────────────────────────────────────
const API_URL = 'http://localhost:5000/api/register'

interface StepReviewProps {
  formData: TeamFormValues
  onBack: () => void
  onSuccess: (registrationId: string) => void
}

export default function StepReview({ formData, onBack, onSuccess }: StepReviewProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const registrationId = Math.random().toString(36).substring(2, 10).toUpperCase()
      
      const payload = {
        registrationId,
        teamName: formData.teamName,
        members: formData.members,
        timestamp: new Date().toISOString()
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to submit registration')
      }
      toast.success('🔥 Team registered successfully!')
      onSuccess(registrationId)
    } catch (err: unknown) {
      const errorDetail = err instanceof Error ? err.message : String(err)
      setError(`Submission failed: ${errorDetail}`)
      console.error('Submission Error:', err)
      toast.error('Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const { teamName, members } = formData

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl text-white mb-1">Review & Submit</h2>
        <p className="text-gray-500 text-sm">Confirm your team details before locking in</p>
      </div>

      {/* Team name card */}
      <div className="p-4 rounded-xl mb-4"
        style={{ background: 'rgba(255,107,0,0.06)', border: '1px solid rgba(255,107,0,0.2)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-ember-400 uppercase tracking-widest mb-1">Team Name</p>
            <p className="font-display font-bold text-xl text-white">{teamName}</p>
          </div>
          <FiZap className="text-ember-500 w-6 h-6" />
        </div>
      </div>

      {/* Members list */}
      <div className="space-y-3 mb-6">
        <p className="text-xs font-mono text-ember-400 uppercase tracking-widest flex items-center gap-2">
          <FiUsers className="w-3 h-3" /> Members ({members.length})
        </p>
        {members.map((member, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="p-4 rounded-xl"
            style={{
              background: 'rgba(22,22,37,0.6)',
              border: i === 0 ? '1px solid rgba(255,107,0,0.25)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  background: i === 0 ? 'rgba(255,107,0,0.2)' : 'rgba(255,255,255,0.05)',
                  border: i === 0 ? '1px solid rgba(255,107,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                <span className="text-xs font-bold" style={{ color: i === 0 ? '#ff6b00' : '#6b7280' }}>
                  {i === 0 ? '👑' : i + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-white text-sm truncate">{member.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 mt-1.5">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                    <FiMail className="w-3 h-3 flex-shrink-0" />{member.email}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <FiPhone className="w-3 h-3 flex-shrink-0" />{member.phone}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                    <FiBook className="w-3 h-3 flex-shrink-0" />{member.college}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl mb-4 text-sm text-flame-400"
          style={{ background: 'rgba(255,48,17,0.08)', border: '1px solid rgba(255,48,17,0.2)' }}
        >
          {error}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={submitting}
          className="btn-outline-ember flex-1 flex items-center justify-center gap-2"
        >
          <FiEdit2 className="w-4 h-4" />
          Edit
        </button>
        <motion.button
          onClick={handleSubmit}
          disabled={submitting}
          whileHover={{ scale: submitting ? 1 : 1.02 }}
          whileTap={{ scale: submitting ? 1 : 0.97 }}
          className="btn-ember flex-1 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <>
              <FiCheck className="w-4 h-4" />
              Confirm Registration
            </>
          )}
        </motion.button>
      </div>

      <p className="text-center text-xs text-gray-600 mt-4">
        By registering, you agree to the event's terms and code of conduct
      </p>
    </motion.div>
  )
}
