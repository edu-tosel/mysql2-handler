import { DbError, PoolError, isDbError } from "./dbError";
import mysql2 from "mysql2/promise";

export type ResultSetHeader = mysql2.ResultSetHeader;
export type RowDataPacket = mysql2.RowDataPacket;
export const format = mysql2.format;

const {
  DB_HOST: host,
  DB_USER: user,
  DB_PASSWORD: password,
  DB_NAME: database,
  DB_PORT: port,
  DATE_STRINGS: dateStringsString,
  DEBUG: debugString,
  CONNECTION_LIMIT: connectionLimitString,
  TIMEZONE: timezone,
} = process.env;
const availableDateStrings = ["DATE", "DATETIME", "TIMESTAMP"] as const;
const dateStrings: (typeof availableDateStrings)[number][] = dateStringsString
  ? dateStringsString
      .toUpperCase()
      .split(",")
      .map((s) => s.replace(/ /g, ""))
      .filter((s: any): s is (typeof availableDateStrings)[number] =>
        availableDateStrings.includes(s)
      )
  : ["DATE"];
const debug = debugString ? debugString === "true" : false;
const connectionLimit = parseInt(connectionLimitString || "5");
const pool = mysql2.createPool({
  host,
  user,
  password,
  database,
  port: port ? parseInt(port) : 3306,
  debug,
  connectionLimit,
  dateStrings,
  timezone: timezone ?? "Z",
});
/**
 * @param callback Callback function that use connection.
 * If you want to handle error by yourself with `null`, use `option.throwError`.
 * @throws {PoolError | DbError | Error}
 */
export async function handler<T>(
  callback: (connection: mysql2.Connection) => Promise<T>,
  option?: { throwError?: true }
): Promise<T>;
/**
 * It is safe because of top level `try...catch`.
 * @param callback Callback function that use connection.
 * @param option If you want to throw error, use `option.throwError` or leave it blank.
 * @throws {never}
 */
export async function handler<T>(
  callback: (connection: mysql2.Connection) => Promise<T>,
  option?: { throwError: false }
): Promise<T | null>;
export async function handler<T>(
  callback: (connection: mysql2.Connection) => Promise<T>,
  option: {
    throwError?: boolean;
    removeUndefinedInFormatting?: boolean;
    printSqlError?: boolean;
    rollbackIfError?: boolean;
  } = {
    throwError: true,
    removeUndefinedInFormatting: true,
    printSqlError: true,
    rollbackIfError: true,
  }
) {
  const connection = await getConnection();
  if (connection === null) return null;
  await connection.beginTransaction();
  try {
    const response = await callback(connection);
    await connection.commit();
    return response;
  } catch (e) {
    await connection.rollback();
    if (isDbError(e)) {
      if (option?.printSqlError) {
        console.error(e.sql);
        console.error(e.sqlMessage);
        console.error(e.sqlState);
        console.error(e.errno);
        console.error(e.code);
      }
      if (option?.throwError) throw new DbError(e);
      else return null;
    }
    const throwError = option?.throwError ?? true;
    if (throwError) throw e;
    else return null;
  } finally {
    connection.release();
  }
  async function getConnection() {
    try {
      const poolConnection = await pool.getConnection();
      // if (option?.removeUndefinedInFormatting) {
      //   const query = (sql: string, values?: any) => {
      //     if (values) {
      //       if (Array.isArray(values)) {
      //         const newValues = values.map((v) => (v === undefined ? null : v));
      //         return poolConnection.query(mysql2.format(sql, newValues));
      //       } else return poolConnection.query(sql, values);
      //     } else return sql;
      //   };
      //   return { ...poolConnection, query } as mysql2.PoolConnection;
      // } else
      return poolConnection;
    } catch (e) {
      console.error("Connection does not created.");
      if (option?.throwError)
        throw new PoolError("Connection does not created.");
      else return null;
    }
  }
}
handler(async()=>1);