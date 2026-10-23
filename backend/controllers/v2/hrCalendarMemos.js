/**
 * Finance V2 schools' HR, Calendar and Memo Board, from the school's own app.
 *
 *   employees / user types  HR v3 employees and the portal user types (404 "HR is not
 *                           enabled" where the school has HR v3 off)
 *   attendance              HR v3 daily attendance: the school's own AM in / AM out /
 *                           PM in / PM out per employee, shown as IN/OUT rows
 *   calendar                the school calendar (school_calendar)
 *   memos                   the school's memorandums (the portal's only writes)
 */
import { callSchool, v2Handler, withMeta, SchoolApiError } from '../../config/schoolApi.js'
import db from '../../config/db.js'

const fetchAllPages = async (school, path, query = {}, perPage = 200, maxPages = 50) => {
  const rows = []
  for (let page = 1; page <= maxPages; page++) {
    const res = await callSchool(school, path, { query: { ...query, page, per_page: perPage } })
    rows.push(...(res.data || []))
    if (page >= (res.last_page || 1)) break
  }
  return rows
}

// ---- Employees ----

const toEmployee = (e) => ({
  id: e.id,
  teacher_id: e.id,
  tid: e.tid,
  name: e.full_name,
  full_name: e.full_name,
  email: e.email || e.user_email || null,
  usertype_id: e.primary_portal_id,
  usertype: e.primary_portal_id,
  usertype_name: e.primary_portal_name || e.organizational_designation_name || null,
  additional_types: String(e.additional_portals || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ usertype: null, usertype_name: name })),
  designation_name: e.designation_name || e.organizational_designation_name || null,
  job_status_name: e.job_status_name || null,
  datehired: e.datehired || null,
  status: e.status,
  isactive: e.isactive,
  picurl: e.picurl || null,
})

export const getAllEmployeesV2 = v2Handler(async (school) => (await fetchAllPages(school, '/employees')).map(toEmployee), 'employees')

export const getEmployeeByIdV2 = v2Handler(async (school, body, req) => {
  const res = await callSchool(school, `/employees/${encodeURIComponent(req.params.id)}`)
  const employee = res.data || res
  if (!employee || !employee.id) throw new SchoolApiError(404, 'Employee not found')
  return toEmployee(employee)
}, 'employee')

export const getUserTypesV2 = v2Handler(async (school) => {
  const res = await callSchool(school, '/user-types')
  return (Array.isArray(res) ? res : res.data || []).map((t) => ({ id: t.id, utype: t.name, group: t.group }))
}, 'user types')

// ---- Attendance ----

const to24h = (value) => {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (!m) return null
  let h = Number(m[1])
  if (m[4]) {
    const pm = m[4].toUpperCase() === 'PM'
    if (h === 12) h = pm ? 12 : 0
    else if (pm) h += 12
  }
  return `${String(h).padStart(2, '0')}:${m[2]}:${m[3] || '00'}`
}

const dateRange = (start, end, maxDays = 31) => {
  const days = []
  const d = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end || start}T00:00:00Z`)
  while (d <= last && days.length < maxDays) {
    days.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

export const getEmployeeAttendanceV2 = v2Handler(async (school, body) => {
  const today = new Date().toISOString().slice(0, 10)
  const days = dateRange(body.startDate || today, body.endDate || body.startDate || today)
  const usertypeId = body.usertypeId && body.usertypeId !== 'all' ? String(body.usertypeId) : null
  const tapstate = body.tapstate && body.tapstate !== 'all' ? String(body.tapstate).toUpperCase() : null

  // The attendance rows carry no user type; the school's employee list has it.
  const types = new Map(
    (await fetchAllPages(school, '/employees')).map((e) => [e.id, { id: e.primary_portal_id, name: e.primary_portal_name }])
  )

  const rows = []
  for (const day of days) {
    const list = await fetchAllPages(school, '/attendance', { date: day }, 100)
    for (const e of list) {
      const type = types.get(e.id) || {}
      if (usertypeId && String(type.id ?? '') !== usertypeId) continue
      const slots = [
        ['am_in', 'IN', e.am_in_source],
        ['am_out', 'OUT', e.am_out_source],
        ['pm_in', 'IN', e.pm_in_source],
        ['pm_out', 'OUT', e.pm_out_source],
      ]
      for (const [field, state, source] of slots) {
        const ttime = to24h(e[field])
        if (!ttime || (tapstate && tapstate !== state)) continue
        rows.push({
          id: e[`${field}_log_id`] || `${e.id}-${day}-${field}`,
          tdate: day,
          ttime,
          tapstate: state,
          person_id: e.id,
          identifier: e.rfid || e.emp_id,
          full_name: e.full_name,
          person_type: 'employee',
          usertype_id: type.id ?? null,
          usertype_name: type.name || e.designation_name || e.department_name || null,
          station_id: source || null,
          created_at: `${day} ${ttime}`,
          attendance_status: e.display_status_label || e.attendance_status,
        })
      }
    }
  }
  rows.sort((a, b) => `${b.tdate} ${b.ttime}`.localeCompare(`${a.tdate} ${a.ttime}`))
  return withMeta(rows, { total: rows.length, days: days.length, source: 'school' })
}, 'employee attendance')

// ---- Calendar ----

export const getSchoolCalendarEventsV2 = v2Handler(async (school, body) => {
  const today = new Date()
  const start = body.startDate ? new Date(`${body.startDate}T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), 1)
  const end = body.endDate ? new Date(`${body.endDate}T00:00:00`) : new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const events = new Map()
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  for (let i = 0; cursor <= end && i < 24; i++) {
    const res = await callSchool(school, '/calendar/events', { query: { month: cursor.getMonth() + 1, year: cursor.getFullYear() } })
    for (const e of Array.isArray(res) ? res : res.data || []) events.set(e.id, e)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const startKey = start.toISOString().slice(0, 10)
  const endKey = end.toISOString().slice(0, 10)
  return Array.from(events.values())
    .filter((e) => String(e.end || e.start).slice(0, 10) >= startKey && String(e.start).slice(0, 10) <= endKey)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
}, 'calendar events')

// ---- Memos ----

export const getAllMemosV2 = v2Handler(async (school) => (await callSchool(school, '/memos')).data || [], 'memos')

export const getMemoByIdV2 = v2Handler(async (school, body, req) => {
  return (await callSchool(school, `/memos/${encodeURIComponent(req.params.id)}`)).data
}, 'memo')

export const createMemoV2 = v2Handler(async (school, body, req) => {
  if (!body.title || !body.content) throw new SchoolApiError(400, 'Title and content are required')
  const [users] = await db.query('SELECT username FROM users WHERE id = ?', [req.user?.id])
  const res = await callSchool(school, '/memos', {
    method: 'POST',
    body: { title: body.title, content: body.content, user_ids: body.user_ids || [], createdby: users[0]?.username || 'SchoolAdmin' },
  })
  return res.data
}, 'memo')

export const updateMemoV2 = v2Handler(async (school, body, req) => {
  await callSchool(school, `/memos/${encodeURIComponent(req.params.id)}`, {
    method: 'PUT',
    body: { title: body.title, content: body.content, user_ids: body.user_ids || [] },
  })
  return null
}, 'memo')

export const deleteMemoV2 = v2Handler(async (school, body, req) => {
  await callSchool(school, `/memos/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' })
  return null
}, 'memo')
