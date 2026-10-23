import db from '../config/db.js'

/**
 * Resolves the school a request is for from the portal's own database and attaches it.
 *
 * The browser only says WHICH school (`schoolId`, or `schoolDbConfig.db_name` from older
 * pages); anything else it sends (host, user, password) is ignored. The school must be
 * assigned to the user (super-admins see every school). After this:
 *   req.school               the school row (app_url, finance_v1, db_* ...)
 *   req.body.schoolDbConfig  server-side connection settings, for the Finance V1 modules
 *                            that still read the school database directly
 */
export const attachSchool = async (req, res, next) => {
  const schoolId = req.body?.schoolId ?? req.query?.schoolId
  const dbName = req.body?.schoolDbConfig?.db_name
  if ((schoolId === undefined || schoolId === null || schoolId === '') && !dbName) return next()

  try {
    const isSuperAdmin = req.user?.role === 'super-admin'
    const byId = schoolId !== undefined && schoolId !== null && schoolId !== ''
    const [rows] = await db.query(
      `SELECT s.id, s.school_name, s.abbrv, s.finance_v1, s.app_url,
              s.db_host, s.db_port, s.db_name, s.db_username, s.db_password
       FROM schools s
       ${isSuperAdmin ? '' : 'INNER JOIN user_schools us ON us.school_id = s.id AND us.user_id = ?'}
       WHERE ${byId ? 's.id = ?' : 's.db_name = ?'}
       LIMIT 1`,
      isSuperAdmin ? [byId ? schoolId : dbName] : [req.user?.id, byId ? schoolId : dbName]
    )
    const school = rows[0]
    if (!school) {
      return res.status(403).json({ status: 'error', message: 'You do not have access to this school' })
    }

    req.school = school
    if (req.body && typeof req.body === 'object') {
      req.body.schoolDbConfig = {
        db_host: school.db_host,
        db_port: school.db_port,
        db_name: school.db_name,
        db_username: school.db_username,
        db_password: school.db_password,
        finance_v1: school.finance_v1,
      }
    }
    next()
  } catch (error) {
    console.error('Error resolving school:', error)
    res.status(500).json({ status: 'error', message: 'Failed to resolve school' })
  }
}
