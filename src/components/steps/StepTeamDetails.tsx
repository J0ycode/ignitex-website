import { motion, AnimatePresence } from 'framer-motion'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FiPlus, FiTrash2, FiUser, FiMail, FiPhone, FiBook } from 'react-icons/fi'

export interface TeamMember {
  name: string
  email: string
  phone: string
  college: string
  isLeader: boolean
}

const memberSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  email:    z.string().email('Invalid email address'),
  phone:    z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  college:  z.string().min(2, 'College name required'),
  isLeader: z.boolean(),
})

const formSchema = z.object({
  teamName: z
    .string()
    .min(3, 'Team name must be at least 3 characters')
    .max(40, 'Team name too long')
    .regex(/^[a-zA-Z0-9 _\-!]+$/, 'Only letters, numbers, spaces and - _ ! allowed'),
  members: z
    .array(memberSchema)
    .min(2, 'Minimum 2 members required')
    .max(4, 'Maximum 4 members allowed'),
})

export type TeamFormValues = z.infer<typeof formSchema>

interface StepTeamDetailsProps {
  initialValues?: TeamFormValues
  onNext: (data: TeamFormValues) => void
}

const defaultMember = (isLeader = false): TeamMember => ({
  name: '',
  email: '',
  phone: '',
  college: '',
  isLeader: isLeader,
})

export default function StepTeamDetails({ initialValues, onNext }: StepTeamDetailsProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TeamFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues ?? {
      teamName: '',
      members: [
        defaultMember(true),
        defaultMember(false),
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'members' })

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="mb-6">
        <h2 className="font-display font-bold text-2xl text-white mb-1">Team Details</h2>
        <p className="text-gray-500 text-sm">2–4 members · Enter details carefully</p>
      </div>

      <form onSubmit={handleSubmit(onNext)} className="space-y-6">
        {/* Team name */}
        <div>
          <label className="label-galaksi">Team Name <span className="text-galaksi-500">*</span></label>
          <input
            {...register('teamName')}
            placeholder="e.g. NeuralNinjas"
            className={`input-galaksi ${errors.teamName ? 'error' : ''}`}
          />
          {errors.teamName && (
            <p className="text-galaksi-400 text-xs mt-1">{errors.teamName.message}</p>
          )}
        </div>

        {/* Members */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="label-galaksi mb-0">Team Members</label>
            <span className="text-xs font-mono text-gray-500">{fields.length} / 4</span>
          </div>

          <AnimatePresence>
            {fields.map((field, index) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="mb-4 p-4 rounded-xl"
                style={{
                  background: 'rgba(22,22,37,0.6)',
                  border: index === 0
                    ? '1px solid rgba(166,149,227,0.35)'
                    : '1px solid rgba(166,149,227,0.12)',
                }}
              >
                {/* Member header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-sm font-semibold"
                    style={{ color: index === 0 ? '#a695e3' : '#9ca3af' }}>
                    {index === 0 ? '👑 Team Leader (You)' : `Member ${index + 1}`}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-gray-600 hover:text-galaksi-400 transition-colors p-1"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Name */}
                  <div>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        {...register(`members.${index}.name`)}
                        placeholder="Full Name"
                        className={`input-galaksi pl-10 ${errors.members?.[index]?.name ? 'error' : ''}`}
                      />
                    </div>
                    {errors.members?.[index]?.name && (
                      <p className="text-galaksi-400 text-xs mt-1">{errors.members[index].name?.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        {...register(`members.${index}.email`)}
                        placeholder="Email"
                        className={`input-galaksi pl-10 ${errors.members?.[index]?.email ? 'error' : ''}`}
                      />
                    </div>
                    {errors.members?.[index]?.email && (
                      <p className="text-galaksi-400 text-xs mt-1">{errors.members[index].email?.message}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        {...register(`members.${index}.phone`)}
                        placeholder="10-digit Mobile"
                        maxLength={10}
                        className={`input-galaksi pl-10 ${errors.members?.[index]?.phone ? 'error' : ''}`}
                      />
                    </div>
                    {errors.members?.[index]?.phone && (
                      <p className="text-galaksi-400 text-xs mt-1">{errors.members[index].phone?.message}</p>
                    )}
                  </div>

                  {/* College */}
                  <div>
                    <div className="relative">
                      <FiBook className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                      <input
                        {...register(`members.${index}.college`)}
                        placeholder="College / Institution"
                        className={`input-galaksi pl-10 ${errors.members?.[index]?.college ? 'error' : ''}`}
                      />
                    </div>
                    {errors.members?.[index]?.college && (
                      <p className="text-galaksi-400 text-xs mt-1">{errors.members[index].college?.message}</p>
                    )}
                  </div>

                  {/* isLeader is set correctly via defaultValues and synced on add */}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Array-level error */}
          {errors.members?.root && (
            <p className="text-galaksi-400 text-xs mt-1">{errors.members.root.message}</p>
          )}
          {typeof errors.members?.message === 'string' && (
            <p className="text-galaksi-400 text-xs mt-1">{errors.members.message}</p>
          )}

          {/* Add member button */}
          {fields.length < 4 && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => append(defaultMember(false))}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-display font-medium transition-all duration-200"
              style={{
                border: '1px dashed rgba(166,149,227,0.3)',
                color: 'rgba(166,149,227,0.7)',
                background: 'rgba(166,149,227,0.04)',
              }}
            >
              <FiPlus className="w-4 h-4" />
              Add Member ({fields.length}/4)
            </motion.button>
          )}
        </div>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-galaksi w-full"
        >
          Review & Submit →
        </motion.button>
      </form>
    </motion.div>
  )
}
