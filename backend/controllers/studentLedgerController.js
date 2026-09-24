import db from '../config/db.js'

const REQUEST_TIMEOUT_MS = 120000

class LedgerError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// The app URL comes from our own DB (never the client) and only for schools assigned to the user.
const resolveSchool = async (req) => {
  const dbName = req.body?.schoolDbConfig?.db_name
  if (!dbName) throw new LedgerError(400, 'School database configuration is required')

  const [rows] = await db.query(
    `SELECT s.id, s.finance_v1, s.app_url
     FROM schools s
     INNER JOIN user_schools us ON us.school_id = s.id
     WHERE s.db_name = ? AND us.user_id = ?
     LIMIT 1`,
    [dbName, req.user?.id]
  )
  const school = rows[0]
  if (!school) throw new LedgerError(403, 'You do not have access to this school')
  if (Number(school.finance_v1) === 1) {
    throw new LedgerError(400, 'Student Ledgers is only available for Finance V2 schools')
  }
  if (!school.app_url) {
    throw new LedgerError(400, 'School URL is not configured. Ask a super admin to set it in School Management.')
  }
  return school
}

const callSchoolApp = async (school, path, params = {}) => {
  const apiKey = process.env.SCHOOL_APP_API_KEY
  if (!apiKey) throw new LedgerError(500, 'SCHOOL_APP_API_KEY is not configured on the server')

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.append(key, String(value))
  }
  const url = `${school.app_url}/api/schooladmin/finance-v2${path}${query.size ? `?${query}` : ''}`

  let response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'X-SchoolAdmin-Key': apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    console.error(`Student ledger request failed (${url}):`, error)
    throw new LedgerError(502, 'Could not reach the school system')
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    throw new LedgerError(502, `School system returned an invalid response (HTTP ${response.status})`)
  }

  if (!response.ok || payload?.success === false) {
    const message =
      response.status === 401 || response.status === 503
        ? 'School system rejected the API key. Check SCHOOL_APP_API_KEY / SCHOOLADMIN_API_KEY.'
        : payload?.message || `School system error (HTTP ${response.status})`
    throw new LedgerError(502, message)
  }
  return payload
}

const handle = (fn) => async (req, res) => {
  try {
    const school = await resolveSchool(req)
    const data = await fn(school, req.body || {})
    res.status(200).json({ status: 'success', data })
  } catch (error) {
    if (!(error instanceof LedgerError)) console.error('Student ledger error:', error)
    res.status(error.status || 500).json({
      status: 'error',
      message: error instanceof LedgerError ? error.message : 'Failed to load student ledger data',
    })
  }
}

export const getStudentLedgerFilters = handle(async (school) => {
  const data = await callSchoolApp(school, '/filters')
  const gradeLevels = Object.values(data.gradelevels || {}).flat()
  return {
    schoolYears: data.schoolyears || [],
    semesters: data.semesters || [],
    programs: (data.academicPrograms || []).map(({ id, progname, acadprogcode }) => ({ id, progname, acadprogcode })),
    gradeLevels: gradeLevels.map(({ id, levelname, acadprogid, sortid }) => ({ id, levelname, acadprogid, sortid })),
    statuses: data.studentStatuses || [],
  }
})

export const getStudentLedgerList = handle(async (school, body) => {
  const perPage = Math.min(Math.max(Number.parseInt(body.perPage, 10) || 25, 1), 100)
  const data = await callSchoolApp(school, '/students', {
    school_year: body.syid,
    semester: body.semid,
    academic_program: body.programId,
    academic_level: body.levelId,
    status: body.status,
    search: body.search,
    page: Math.max(Number.parseInt(body.page, 10) || 1, 1),
    per_page: perPage,
  })

  return {
    students: (data.data || []).map((s) => ({
      id: s.id,
      sid: s.sid,
      fullname: s.fullname,
      academic_level: s.academic_level,
      program_name: s.program_name,
      section_name: s.section_name,
      course_name: s.course_name,
      strandcode: s.strandcode,
      grantee: s.grantee_desc,
      status: s.studstatus_desc,
      is_enrolled: Number(s.is_enrolled) === 1,
      totals: s.financial_data?.totals || null,
    })),
    pagination: data.pagination || null,
  }
})

export const getStudentLedger = handle(async (school, body) => {
  if (!body.studid) throw new LedgerError(400, 'Student is required')
  const data = await callSchoolApp(school, '/students/ledger', {
    studid: body.studid,
    syid: body.syid,
    semid: body.semid,
  })
  const { success, school_fees, ...ledger } = data
  return ledger
})
