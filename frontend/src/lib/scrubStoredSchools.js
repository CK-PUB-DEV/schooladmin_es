// Older logins stored each school's database host, user and password in localStorage
// (`user.schools[]`, `selectedSchool`). The backend no longer sends them and resolves the
// school itself, so remove any copy a browser still holds.
const SECRET_FIELDS = ['db_host', 'db_port', 'db_username', 'db_password']

const scrub = (school) => {
  if (!school || typeof school !== 'object') return school
  const clean = { ...school }
  SECRET_FIELDS.forEach((field) => delete clean[field])
  return clean
}

export function scrubStoredSchools() {
  try {
    const selected = JSON.parse(localStorage.getItem('selectedSchool') || 'null')
    if (selected && SECRET_FIELDS.some((f) => f in selected)) {
      localStorage.setItem('selectedSchool', JSON.stringify(scrub(selected)))
    }

    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (user && Array.isArray(user.schools) && user.schools.some((s) => SECRET_FIELDS.some((f) => f in (s || {})))) {
      localStorage.setItem('user', JSON.stringify({ ...user, schools: user.schools.map(scrub) }))
    }
  } catch {
    // Unreadable storage: nothing to clean.
  }
}
