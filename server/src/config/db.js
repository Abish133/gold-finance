import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: env.db.poolSize,
  waitForConnections: true,
  namedPlaceholders: true,
  decimalNumbers: true,
  dateStrings: true,
  timezone: 'local',
  charset: 'utf8mb4',
  enableKeepAlive: true,
});

/** Run a query; returns rows. */
export const query = async (sql, params = {}) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

/** Returns first row or null. */
export const queryOne = async (sql, params = {}) => (await query(sql, params))[0] ?? null;

/**
 * Run work inside a transaction. `fn` receives a connection-like object with
 * `query` / `queryOne` helpers bound to the same connection.
 */
export const withTransaction = async (fn) => {
  const conn = await pool.getConnection();
  const tx = {
    conn,
    query: async (sql, params = {}) => (await conn.query(sql, params))[0],
    queryOne: async (sql, params = {}) => (await conn.query(sql, params))[0][0] ?? null,
  };
  try {
    await conn.beginTransaction();
    const result = await fn(tx);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Default executor (pool) with the same shape as a transaction object. */
export const db = { query, queryOne };
