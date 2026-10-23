/**
 * Server-to-server calls to a Finance V2 school's own app (es_ldcu), under
 * {app_url}/api/schooladmin/{v2|finance-v2}/..., authenticated with the shared
 * X-SchoolAdmin-Key (SCHOOL_APP_API_KEY here, SCHOOLADMIN_API_KEY there).
 *
 * The portal shows what the school's own pages compute: these calls return the school's
 * data as-is, and the v2 controllers only reshape it for the pages.
 */
const REQUEST_TIMEOUT_MS = 120000

export class SchoolApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** The school must be a Finance V2 school with its URL set (req.school from attachSchool). */
export const requireV2School = (school) => {
  if (!school) throw new SchoolApiError(400, 'School is required')
  if (Number(school.finance_v1) === 1) throw new SchoolApiError(400, 'This page reads Finance V2 schools only')
  if (!school.app_url) {
    throw new SchoolApiError(400, 'School URL is not configured. Ask a super admin to set it in School Management.')
  }
  return school
}

export const callSchool = async (school, path, { query = {}, method = 'GET', body, base = 'v2' } = {}) => {
  const apiKey = process.env.SCHOOL_APP_API_KEY
  if (!apiKey) throw new SchoolApiError(500, 'SCHOOL_APP_API_KEY is not configured on the server')
  requireV2School(school)

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => params.append(`${key}[]`, String(v)))
    else params.append(key, String(value))
  }
  const url = `${school.app_url}/api/schooladmin/${base}${path}${params.size ? `?${params}` : ''}`

  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'X-SchoolAdmin-Key': apiKey,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    console.error(`School API request failed (${method} ${url}):`, error)
    throw new SchoolApiError(502, 'Could not reach the school system')
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    throw new SchoolApiError(502, `School system returned an invalid response (HTTP ${response.status})`)
  }

  if (!response.ok || payload?.success === false) {
    if (response.status === 401 || response.status === 503) {
      throw new SchoolApiError(502, 'School system rejected the API key. Check SCHOOL_APP_API_KEY / SCHOOLADMIN_API_KEY.')
    }
    if (response.status === 404 && path.match(/^\/(employees|attendance)/)) {
      throw new SchoolApiError(404, 'HR is not enabled in this school system')
    }
    const message = payload?.message || `School system error (HTTP ${response.status})`
    throw new SchoolApiError(response.status === 404 ? 404 : response.status === 422 ? 400 : 502, message)
  }
  return payload
}

/** For pages that read `meta` beside `data` (paged lists). */
export const withMeta = (data, meta) => ({ [WITH_META]: true, data, meta })
const WITH_META = Symbol('withMeta')

/** Express handler for a v2 module: `fn(school, body)` returns the page's data. */
export const v2Handler = (fn, label = 'school data') => async (req, res) => {
  try {
    const result = await fn(requireV2School(req.school), req.body || {}, req)
    if (result && result[WITH_META]) {
      return res.status(200).json({ status: 'success', data: result.data, meta: result.meta })
    }
    res.status(200).json({ status: 'success', data: result })
  } catch (error) {
    if (!(error instanceof SchoolApiError)) console.error(`Error loading ${label}:`, error)
    res.status(error.status || 500).json({
      status: 'error',
      message: error instanceof SchoolApiError ? error.message : `Failed to load ${label}`,
    })
  }
}
