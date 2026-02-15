export function isValidEmail(email) {
  if (typeof email !== 'string') return false
  const normalized = email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)
}

export function isStrongEnoughPassword(password) {
  return typeof password === 'string' && password.length >= 8
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

export function makeSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}
