export interface Contact {
  name: string
  phone: string // 10-digit Indian mobile
}

// Organisers people can reach for payment / registration problems
export const CONTACTS: Contact[] = [
  { name: 'Joyel', phone: '6282075201' },
  { name: 'Albin', phone: '9605054721' },
]

export const whatsappUrl = (phone: string, text?: string) =>
  `https://wa.me/91${phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export const formatPhone = (phone: string) => `${phone.slice(0, 5)} ${phone.slice(5)}`
