import mysql from 'mysql2/promise'
import db from '../config/db.js'

// Returns null for empty, undefined for invalid, else the URL without trailing slashes.
const normalizeAppUrl = (value) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
  } catch {
    return undefined
  }
  return trimmed.replace(/\/+$/, '')
}

// Get all schools
export const getAllSchools = async (req, res) => {
  try {
    const [schools] = await db.query(
      'SELECT id, school_name, abbrv, image_logo, address, finance_v1, app_url, db_host, db_port, db_name, db_username, created_at, updated_at FROM schools ORDER BY created_at DESC'
    )

    res.status(200).json({
      status: 'success',
      data: schools,
    })
  } catch (error) {
    console.error('Error fetching schools:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch schools',
    })
  }
}

// Get single school by ID
export const getSchoolById = async (req, res) => {
  try {
    const { id } = req.params

    const [schools] = await db.query(
      'SELECT id, school_name, abbrv, image_logo, address, finance_v1, app_url, db_host, db_port, db_name, db_username, created_at, updated_at FROM schools WHERE id = ?',
      [id]
    )

    if (schools.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'School not found',
      })
    }

    res.status(200).json({
      status: 'success',
      data: schools[0],
    })
  } catch (error) {
    console.error('Error fetching school:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch school',
    })
  }
}

// Create new school
export const createSchool = async (req, res) => {
  try {
    const {
      school_name,
      abbrv,
      image_logo,
      address,
      db_name,
      db_username,
      db_password,
      db_host,
      db_port,
      finance_v1,
      app_url,
    } = req.body

    // Validate required fields (password is optional)
    if (!school_name || !db_name || !db_username) {
      return res.status(400).json({
        status: 'error',
        message: 'School name, database name, and username are required',
      })
    }

    const resolvedAppUrl = normalizeAppUrl(app_url)
    if (resolvedAppUrl === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'School URL must be a valid http(s) URL',
      })
    }

    // Check if school name already exists
    const [existingSchool] = await db.query(
      'SELECT id FROM schools WHERE school_name = ? OR db_name = ?',
      [school_name, db_name]
    )

    if (existingSchool.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'School name or database name already exists',
      })
    }

    const resolvedHost = (db_host || process.env.DB_HOST || 'localhost').trim()
    const parsedPort = Number.parseInt(db_port, 10)
    const resolvedPort = Number.isNaN(parsedPort)
      ? Number.parseInt(process.env.DB_PORT, 10) || 3306
      : parsedPort
    const resolvedFinanceV1 =
      finance_v1 === true || finance_v1 === 1 || finance_v1 === '1' ? 1 : 0

    // Insert new school (password, abbrv, image_logo, address can be empty)
    const [result] = await db.query(
      'INSERT INTO schools (school_name, abbrv, image_logo, address, finance_v1, app_url, db_host, db_port, db_name, db_username, db_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [
        school_name,
        abbrv || '',
        image_logo || '',
        address || '',
        resolvedFinanceV1,
        resolvedAppUrl,
        resolvedHost,
        resolvedPort,
        db_name,
        db_username,
        db_password || '',
      ]
    )

    res.status(201).json({
      status: 'success',
      message: 'School created successfully',
      data: {
        id: result.insertId,
        school_name,
        abbrv,
        image_logo,
        address,
        finance_v1: resolvedFinanceV1,
        app_url: resolvedAppUrl,
        db_host: resolvedHost,
        db_port: resolvedPort,
        db_name,
        db_username,
      },
    })
  } catch (error) {
    console.error('Error creating school:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to create school',
    })
  }
}

// Update school
export const updateSchool = async (req, res) => {
  try {
    const { id } = req.params
    const {
      school_name,
      abbrv,
      image_logo,
      address,
      db_name,
      db_username,
      db_password,
      db_host,
      db_port,
      finance_v1,
      app_url,
    } = req.body

    // Check if school exists
    const [existingSchool] = await db.query(
      'SELECT id FROM schools WHERE id = ?',
      [id]
    )

    if (existingSchool.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'School not found',
      })
    }

    // Check if new school name or db name conflicts with other schools
    const [conflictingSchool] = await db.query(
      'SELECT id FROM schools WHERE (school_name = ? OR db_name = ?) AND id != ?',
      [school_name, db_name, id]
    )

    if (conflictingSchool.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'School name or database name already exists',
      })
    }

    // Build update query dynamically based on provided fields
    let updateFields = []
    let updateValues = []

    if (school_name) {
      updateFields.push('school_name = ?')
      updateValues.push(school_name)
    }
    if (abbrv !== undefined) {
      updateFields.push('abbrv = ?')
      updateValues.push(abbrv)
    }
    if (image_logo !== undefined) {
      updateFields.push('image_logo = ?')
      updateValues.push(image_logo)
    }
    if (address !== undefined) {
      updateFields.push('address = ?')
      updateValues.push(address)
    }
    if (db_name) {
      updateFields.push('db_name = ?')
      updateValues.push(db_name)
    }
    if (db_username) {
      updateFields.push('db_username = ?')
      updateValues.push(db_username)
    }
    if (db_password) {
      updateFields.push('db_password = ?')
      updateValues.push(db_password)
    }
    if (finance_v1 !== undefined) {
      const resolvedFinanceV1 =
        finance_v1 === true || finance_v1 === 1 || finance_v1 === '1' ? 1 : 0
      updateFields.push('finance_v1 = ?')
      updateValues.push(resolvedFinanceV1)
    }
    if (app_url !== undefined) {
      const resolvedAppUrl = normalizeAppUrl(app_url)
      if (resolvedAppUrl === undefined) {
        return res.status(400).json({
          status: 'error',
          message: 'School URL must be a valid http(s) URL',
        })
      }
      updateFields.push('app_url = ?')
      updateValues.push(resolvedAppUrl)
    }
    if (db_host !== undefined) {
      const resolvedHost = (db_host || process.env.DB_HOST || 'localhost').trim()
      updateFields.push('db_host = ?')
      updateValues.push(resolvedHost)
    }
    if (db_port !== undefined) {
      const parsedPort = Number.parseInt(db_port, 10)
      const resolvedPort = Number.isNaN(parsedPort)
        ? Number.parseInt(process.env.DB_PORT, 10) || 3306
        : parsedPort
      updateFields.push('db_port = ?')
      updateValues.push(resolvedPort)
    }

    updateFields.push('updated_at = NOW()')
    updateValues.push(id)

    await db.query(
      `UPDATE schools SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    )

    res.status(200).json({
      status: 'success',
      message: 'School updated successfully',
    })
  } catch (error) {
    console.error('Error updating school:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to update school',
    })
  }
}

// Delete school
export const deleteSchool = async (req, res) => {
  try {
    const { id } = req.params

    // Check if school exists
    const [existingSchool] = await db.query(
      'SELECT id FROM schools WHERE id = ?',
      [id]
    )

    if (existingSchool.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'School not found',
      })
    }

    await db.query('DELETE FROM schools WHERE id = ?', [id])

    res.status(200).json({
      status: 'success',
      message: 'School deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting school:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete school',
    })
  }
}

// Test database connection
export const testConnection = async (req, res) => {
  let connection = null

  try {
    const { db_name, db_username, db_password, db_host, db_port } = req.body

    // Validate required fields (password is optional)
    if (!db_name || !db_username) {
      return res.status(400).json({
        status: 'error',
        message: 'Database name and username are required',
      })
    }

    const resolvedHost = (db_host || process.env.DB_HOST || 'localhost').trim()
    const parsedPort = Number.parseInt(db_port, 10)
    const resolvedPort = Number.isNaN(parsedPort)
      ? Number.parseInt(process.env.DB_PORT, 10) || 3306
      : parsedPort

    // Create connection configuration (password can be empty)
    const connectionConfig = {
      host: resolvedHost,
      user: db_username,
      password: db_password || '',
      database: db_name,
      port: resolvedPort,
    }

    // Attempt to create connection
    connection = await mysql.createConnection(connectionConfig)

    // Test the connection with a simple query
    await connection.query('SELECT 1')

    // Close the connection
    await connection.end()

    res.status(200).json({
      status: 'success',
      message: 'Database connection successful',
    })
  } catch (error) {
    // Close connection if it was opened
    if (connection) {
      try {
        await connection.end()
      } catch (closeError) {
        console.error('Error closing connection:', closeError)
      }
    }

    console.error('Database connection error:', error)

    // Provide specific error messages
    let errorMessage = 'Database connection failed'

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = 'Access denied. Please check username and password.'
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      errorMessage = 'Database does not exist.'
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to database server.'
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout. Please check database server.'
    }

    res.status(400).json({
      status: 'error',
      message: errorMessage,
      details: error.message,
    })
  }
}
