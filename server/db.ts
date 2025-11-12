// PostgreSQL database connection and queries
import { Pool, PoolClient } from 'pg'

let pool: Pool | null = null

/**
 * Initialize database connection pool
 */
export function initDb(): Pool {
  if (pool) return pool

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : undefined,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err)
  })

  return pool
}

/**
 * Get database pool (initializes if needed)
 */
export function getPool(): Pool {
  if (!pool) {
    return initDb()
  }
  return pool
}

/**
 * Run a query with automatic connection management
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const pool = getPool()
  const result = await pool.query(text, params)
  return result.rows as T[]
}

/**
 * Run a query and return single row
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows.length > 0 ? rows[0] : null
}

/**
 * Run a transaction
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Close database pool (for graceful shutdown)
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

