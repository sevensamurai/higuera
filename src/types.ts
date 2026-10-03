export type BookingKind = 'tutoring' | 'freelance'
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'declined' | 'cancelled'
export type PaymentStatus = 'pending' | 'paid'

export interface Slot {
  id: string
  start: Date
  durationMin: number
  status: 'open' | 'booked'
  bookingId?: string
}

/** A slot as copied into a booking, so the booking still reads correctly if the slot is deleted. */
export interface SlotOption {
  slotId: string
  start: Date
  durationMin: number
}

export interface Booking {
  id: string
  userId: string
  userName: string
  userEmail: string
  /** The student's display zone when they requested, so the tutor can see "their" time. */
  userTimeZone?: string
  kind: BookingKind
  /** The session's goal, e.g. "Prepare for the calculus midterm". Set by the student, editable by the tutor. */
  title: string
  /** Extra details the student gave when requesting. Ongoing discussion lives in SessionNote. */
  notes: string
  /** The user's 1–3 preferred slots; the admin confirms one of them. */
  options: SlotOption[]
  status: BookingStatus
  confirmed?: SlotOption
  payment: PaymentStatus
  paymentNote?: string
  paidAt?: Date
  /** Admin's reply on decline, or anything the user should read before the session. */
  adminNote?: string
  /** Written by the admin after the session. */
  summary?: string
  createdAt: Date
}

/** One entry in a session's notes thread; both tutor and student can write. */
export interface SessionNote {
  id: string
  authorId: string
  authorName: string
  role: 'tutor' | 'student'
  text: string
  createdAt: Date
}

export interface Task {
  id: string
  userId: string
  userName: string
  title: string
  details: string
  /** Calendar date yyyy-mm-dd: the same day for everyone, regardless of zone. */
  dueDate?: string
  status: 'open' | 'done'
  bookingId?: string
  createdAt: Date
  completedAt?: Date
}

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  timeZone?: string
  detectedTimeZone?: string
  locale?: 'es' | 'en'
}

/** content/overview: one Overview per language. Older docs hold a single untranslated title/body. */
export type OverviewDoc = Partial<Record<'es' | 'en', Overview>>

export interface Overview {
  title: string
  body: string
}
