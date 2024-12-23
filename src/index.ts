import { DbError, PoolError, isDbError } from "./dbError";
import mysql2 from "mysql2/promise";
import { transfers, crudPackage } from "./repository";

export type ResultSetHeader = mysql2.ResultSetHeader;
export type RowDataPacket = mysql2.RowDataPacket;
export const format = mysql2.format;
export { transfers, crudPackage };

const log = (massage: string) => console.log(`[Mysql2 Handler] ${massage}`);

const readBooleanEnv = (
  record: Record<string, string | undefined>,
  defaultValue?: boolean
) => {
  const [[key, value]] = Object.entries(record);
  if (value === undefined) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  log(
    `Invalid value for ${key}: ${value}; Using default value: ${defaultValue}`
  );
  return defaultValue;
};

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
  CASTED_BOOLEAN,
} = process.env;
const castedBoolean = readBooleanEnv({ CASTED_BOOLEAN });
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
const poolOption = {
  host,
  user,
  password,
  database,
  port: port ? parseInt(port) : 3306,
  debug,
  connectionLimit,
  dateStrings,
  timezone: timezone ?? "Z",
  typeCast: function (field, next) {
    if (field.type === "TINY" && field.length === 1 && castedBoolean)
      return field.string() === "1"; // 1 = true, 0 = false
    if (field.type === "TIMESTAMP") {
      const value = field.string();
      if (dateStrings.includes("TIMESTAMP")) return value;
      if (value === null) return null;
      if (value === "0000-00-00 00:00:00")
        return new Date("1970-01-01 00:00:00");
      // 0000-00-00 00:00:00 = 1970-01-01 00:00:00
      else return new Date(value);
    }
    return next();
  },
} as mysql2.PoolOptions;
const pool = mysql2.createPool(poolOption);

type HandlerOption = {
  throwError?: boolean;
  // removeUndefinedInFormatting?: boolean;
  printSqlError?: boolean;
  rollbackIfError?: boolean;
  useTransaction?: boolean;
};
/**
 * @param callback Callback function that use connection.
 * If you want to handle error by yourself with `null`, use `option.throwError`.
 * @throws {PoolError | DbError | Error}
 */
export async function handler<T>(
  callback: (connection: mysql2.Connection) => Promise<T>,
  option?: { throwError?: true } & HandlerOption
): Promise<T>;
/**
 * It is safe because of top level `try...catch`.
 * @param callback Callback function that use connection.
 * @param option If you want to throw error, use `option.throwError` or leave it blank.
 * @throws {never}
 */
export async function handler<T>(
  callback: (connection: mysql2.Connection) => Promise<T>,
  option?: { throwError: false } & HandlerOption
): Promise<T | null>;
/**
 * @param callback Callback function that use connection.
 * @param option If you want to handle error by yourself with `null`, use `option.throwError`.
 * @throws {PoolError | DbError | Error}
 */
export async function handler<T>(
  callback: (connection: mysql2.Connection) => Promise<T>,
  option: HandlerOption = {
    throwError: true,
    // removeUndefinedInFormatting: true,
    printSqlError: true,
    rollbackIfError: true,
    useTransaction: true,
  }
) {
  const connection = await getConnection();
  if (connection === null) return null;
  if (option.useTransaction) await connection.beginTransaction();
  try {
    const response = await callback(connection);
    if (option.useTransaction) await connection.commit();
    return response;
  } catch (e) {
    if (option.useTransaction && option.rollbackIfError)
      await connection.rollback();
    if (isDbError(e)) {
      if (option.printSqlError) {
        console.error("sql: ", e.sql);
        console.error("sqlMessage: ", e.sqlMessage);
        console.error("sqlState: ", e.sqlState);
        console.error("errno: ", e.errno);
        console.error("code: ", e.code);
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
      console.error(poolOption);
      if (option?.throwError)
        throw new PoolError("Connection does not created.");
      else return null;
    }
  }
}
