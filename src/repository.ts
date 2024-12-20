import { type ResultSetHeader, type RowDataPacket, format, handler } from ".";
import {
  convertToSnakeStrings,
  isArray,
  isBooleanOrUndefined,
  isOptionalArray,
  isString,
  removeUndefined,
} from "./utils";

const log = (message: string) =>
  console.log(`[Mysql2 Handler; Repository] ${message}`);
const warn = (message: string) =>
  console.log(`Warning: [Mysql2 Handler; Repository] ${message}`);
const error = (message: string) =>
  console.error(`Error: [Mysql2 Handler; Repository] ${message}`);

/**
 * Transfer object to row and row to object
 * @typeParam `O` Object type
 * @typeParam `R` RowDataPacket type
 * @param keys Object keys
 * @param columns RowDataPacket columns
 *
 * @example
 * ``` ts
 * const columns = ["id", "name", "addr", "created_at"] as const;
 * const keys = ["id", "name", "addr", "createdAt"] as const;
 *
 * interface User {
 *   id: number;
 *   name: string;
 *   addr: string;
 *   createdAt: Date;
 * }
 *
 * interface UserRow extends RowDataPacket {
 *   id: number;
 *   name: string;
 *   addr: string;
 *   created_at: Date;
 * }
 * const { toObject, toPartialRow, toRow } = transfers<User, UserRow>(keys, columns);
 * const user = toObject(row);
 * ```
 */
export function transfers<
  O extends { [k in K]: R[C] }, // Object type
  R extends { [c in C]: V }, // RowDataPacket type
  K extends string | number | symbol = keyof O, // Key string type
  C extends string | number | symbol = keyof R, // Column string type
  V = any
>(keys: ReadonlyArray<K>, columns: ReadonlyArray<C>) {
  if (keys.length !== columns.length)
    throw new Error("keys and columns length must be same");
  const toObject = (row: R) => {
    const obj = {} as O;
    for (let i = 0; i < columns.length; i++) {
      const key = keys[i];
      const column = columns[i];
      const value = row[column];
      obj[key] = value as unknown as O[K];
    }
    return obj;
  };
  const toRow = (obj: O) => {
    const row = {} as R;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = obj[key];
      const column = columns[i];
      row[column] = value as unknown as R[C];
    }
    return row;
  };
  const toPartialRow = (obj: Partial<O>) => {
    const row = {} as Partial<R>;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = obj[key];
      const column = columns[i];
      if (value === undefined) continue;
      row[column] = value as unknown as R[C];
    }
    return row;
  };
  return { toObject, toRow, toPartialRow };
}

type CompareValue<T = unknown> =
  | NonNullable<T>
  | NonNullable<T>[]
  | "null"
  | "not null"
  | `%${string}%`
  | `%${string}`
  | `${string}%`;
interface CrudPackage<
  O extends { [k in K]: R[C] }, // Object type
  R extends { [c in C]: unknown }, // RowDataPacket type
  AS extends string = never, // Auto set key string type
  K extends keyof O = keyof O, // Key string type
  C extends keyof R = keyof R // Column string type
> {
  /**
   * Find rows
   * @example
   * ``` ts
   * const userFirstAndSecond = await find({id: [1, 2]});
   * const userOfSeoul = await find({addr1: "%서울%"});
   * const userOfAddressNull = await find({addr1: "null"});
   * const userOfAddressNotNull = await find({addr1: "not null"});
   * ```
   * @param query Query object
   */
  find: (query?: {
    [k in K]?: CompareValue<O[k]>;
  }) => Promise<O[]>;
  /**
   * Find one row
   * @example
   * ``` ts
   * const user0 = await findOne({id: 1});
   * type User0 = typeof userOne; // Promise<User | undefined>
   * const user1 = await findOne({id: 1}, {throwError: true});
   * type User1 = typeof userOne; // Promise<User>
   * const user2 = await findOne({id: 1}, {throwError: false});
   * type User2 = typeof userOne; // Promise<User | undefined>
   * ```
   * @param query Query object
   * @param option Option object
   * @param option.throwError If set to true, throw an error if not found
   */
  findOne: {
    (
      query: { [k in K]?: CompareValue<O[k]> },
      { throwError }: { throwError: true }
    ): Promise<O>;
    (
      query: { [k in K]?: CompareValue<O[k]> },
      { throwError }: { throwError?: false }
    ): Promise<O | undefined>;
    (query: { [k in K]?: CompareValue<O[k]> }): Promise<O | undefined>;
  };
  /**
   * Saves the provided setter object to the database.
   *
   * @param setterObj - The setter object containing the data to be saved.
   * @returns A promise that resolves to the result of the save operation.
   */
  save: (setterObj: Omit<O, AS>) => Promise<ResultSetHeader>;
  /**
   * Saves the provided setter objects to the database.
   *
   * @param setterObjs - An array of setter objects containing the data to be saved.
   * @returns A promise that resolves to the result of the save operation.
   */
  saveMany: (setterObjs: Omit<O, AS>[]) => Promise<ResultSetHeader>;
  /**
   * Updates rows in the database based on the provided setter object and query.
   *
   * @param setterObj - The partial object containing the values to be updated.
   * @param query - The query object specifying the conditions for the update.
   * @param option - Optional configuration for the update operation.
   * @param option.allowAffectAll - If set to true, allows updating all rows when the setter object is empty.
   *
   * @returns A promise that resolves to the result of the update operation.
   *
   * @throws An error if the setterObj is empty and option.allowAffectAll is not set to true.
   */
  update: (
    setterObj: Partial<O>,
    query: { [k in K]?: CompareValue<O[k]> },
    option?: { allowAffectAll?: boolean }
  ) => Promise<ResultSetHeader>;
  /**
   * Deletes records from the database based on the provided query.
   */
  _delete: (
    query: { [k in K]?: CompareValue<O[k]> },
    option?: { allowAffectAll?: boolean }
  ) => Promise<ResultSetHeader>;
  /**
   * Deletes records from the database based on the provided query.
   *
   * @param query - The query object specifying the records to delete.
   * @param option - Optional configuration for the delete operation.
   * @param option.allowAffectAll - If set to true, allows deleting all records when the query is empty.
   *
   * @returns A promise that resolves to the number of affected rows.
   *
   * @throws An error if the query is empty and option.allowAffectAll is not set to true.
   */
  delete: (
    query: { [k in K]?: CompareValue<O[k]> },
    option?: { allowAffectAll?: boolean }
  ) => Promise<ResultSetHeader>;
  handler: typeof handler;
  toObject: (row: R) => O;
  toRow: (obj: O) => R;
  toPartialRow: (obj: Partial<O>) => Partial<R>;
}
/**
 * Create CRUD functions and handler and transfer functions.
 * @typeParam `O` Object type
 * @typeParam `R` RowDataPacket type
 * @typeParam `AS` Auto set key string type like 'id' or 'createdAt' or 'updatedAt' you can't set this key when you update or save
 * @param keys Object keys
 * @param columns RowDataPacket columns
 * @param option.table Table name
 * @param option.printQuery Print query
 * @returns CRUD functions and handler and transfer functions
 * @example
 * ``` ts
 * interface User {
 *   id: number;
 *   name: string;
 *   addr: string;
 *   createdAt: Date;
 * }
 * interface UserRow extends RowDataPacket {
 *   id: number;
 *   name: string;
 *   addr: string;
 *   created_at: Date;
 * }
 * const columns = ["id", "name", "addr", "created_at"] as const;
 * const keys = ["id", "name", "addr", "createdAt"] as const;
 * const { _delete, find, save, update } = crudPackage<User, UserRow, "id" | "createdAt">(
 *   keys,
 *   columns,
 *   { table: "user" }
 * );
 * ```
 */
export function _crudPackage<
  O extends { [k in K]: R[C] }, // Object type
  R extends { [c in C]: unknown }, // RowDataPacket type
  AS extends string = never, // Auto set key string type
  K extends keyof O = keyof O, // Key string type
  C extends keyof R = keyof R // Column string type
>(
  keys: ReadonlyArray<K>,
  columns: ReadonlyArray<C>,
  option: {
    table: string;
    printQuery?: boolean;
    transfers?: {
      toObject: (row: R) => O;
      toRow: (obj: O) => R;
      toPartialRow: (obj: Partial<O>) => Partial<R>;
    };
    autoSetColumns?: AS[];
  }
): CrudPackage<O, R, AS, K, C> {
  const printQuery = option.printQuery === true;
  const table = option.table;
  const { toObject, toPartialRow, toRow } =
    option.transfers || transfers<O, R, K, C>(keys, columns);
  type Query = {
    [k in K]?: CompareValue<O[k]>;
  };
  type Setter = Omit<O, AS>;
  const queryString = {
    selectAll: format("SELECT ?? FROM ??;", [columns, table]),
    selectQuery: format("SELECT ?? FROM ?? WHERE ", [columns, table]),
    insert: format("INSERT INTO ?? (??) VALUE ?;", [table, columns]),
    insertMany: format("INSERT INTO ?? (??) VALUES ?", [table, columns]),
    update: format("UPDATE ?? SET ? WHERE ", [table]),
    updateAll: format("UPDATE ?? SET ?;", [table]),
    delete: format("DELETE FROM ?? WHERE ", [table]),
    deleteAll: format("DELETE FROM ??;", [table]),
  };

  function printQueryIfNeeded(query: string) {
    if (printQuery) return console.log(query);
    else return;
  }
  const find = async (query?: Query) =>
    handler(async (connection) => {
      query = removeUndefined(query);
      if (!query || Object.keys(query).length === 0) {
        const [rows] = await connection.query<(R & RowDataPacket)[]>(
          queryString.selectAll
        );
        return rows.map(toObject);
      }
      const condition = getCondition(query);
      const [rows] = await connection.query<(R & RowDataPacket)[]>(
        queryString.selectQuery + condition
      );
      printQueryIfNeeded(
        connection.format(queryString.selectQuery + condition)
      );
      return rows.map(toObject);
    });
  const findOne: {
    (query: Query, { throwError }: { throwError: true }): Promise<O>;
    (query: Query, { throwError }: { throwError?: false }): Promise<
      O | undefined
    >;
    (query: Query, { throwError }?: { throwError?: boolean }): Promise<
      O | undefined
    >;
  } = async (
    query: Query,
    { throwError }: { throwError?: boolean } = {}
  ): Promise<any> => {
    const rows = await find(query);
    if (rows.length === 0 && throwError) throw new Error("Not Found");
    else if (rows.length > 1 && throwError) throw new Error("Multiple Found");
    else if (!throwError) return rows.at(0);
    else return rows[0];
  };
  const save = async (setterObj: Setter) =>
    handler(
      async (connection) => {
        setterObj = removeUndefined(setterObj);
        const value = keys.map((key) => {
          if (key in setterObj)
            return setterObj[key as unknown as keyof typeof setterObj];
          else return undefined;
        });
        const [result] = await connection.query<ResultSetHeader>(
          queryString.insert,
          [[value]]
        );

        printQueryIfNeeded(connection.format(queryString.insert, [[value]]));
        return result;
      },
      { useTransaction: false }
    );
  const saveMany = async (setterObjs: Setter[]) =>
    handler(
      async (connection): Promise<ResultSetHeader> => {
        if (setterObjs.length === 0)
          return {
            affectedRows: 0,
            insertId: 0,
            info: "",
            fieldCount: 0,
            serverStatus: 0,
            warningStatus: 0,
            changedRows: 0,
          } as ResultSetHeader;
        setterObjs = setterObjs.map(removeUndefined);
        const values = setterObjs.map((setterObj) =>
          keys.map((key) => {
            if (key in setterObj)
              return setterObj[key as unknown as keyof typeof setterObj];
            else return undefined;
          })
        );
        const [result] = await connection.query<ResultSetHeader>(
          queryString.insertMany,
          [values]
        );

        printQueryIfNeeded(connection.format(queryString.insertMany, [values]));
        return result;
      },
      { useTransaction: false }
    );

  const update = async (
    setterObj: Partial<Setter>,
    query: Query,
    option?: { allowAffectAll?: boolean }
  ) =>
    handler(async (connection) => {
      setterObj = removeUndefined(setterObj);
      query = removeUndefined(query);
      const row = toPartialRow(setterObj as Partial<O>);
      if (Object.keys(query).length === 0) {
        if (option?.allowAffectAll) {
          const [result] = await connection.query<ResultSetHeader>(
            queryString.updateAll
          );
          printQueryIfNeeded(queryString.updateAll);
          return result;
        } else
          throw new Error(
            "Query is empty and allowAffectAll is false, " +
              "to update all rows, " +
              "set allowAffectAll to true"
          );
      } else {
        const condition = getCondition(query);
        const [result] = await connection.query<ResultSetHeader>(
          queryString.update + condition,
          [row]
        );
        printQueryIfNeeded(
          connection.format(queryString.update + condition, [row])
        );
        return result;
      }
    });
  const _delete = async (query: Query, option?: { allowAffectAll?: boolean }) =>
    handler(async (connection) => {
      query = removeUndefined(query);
      const condition = getCondition(query);
      if (Object.keys(query).length === 0) {
        if (option?.allowAffectAll) {
          const [result] = await connection.query<ResultSetHeader>(
            queryString.deleteAll
          );
          printQueryIfNeeded(queryString.deleteAll);
          return result;
        } else throw new Error("query is empty");
      } else {
        const [result] = await connection.query<ResultSetHeader>(
          queryString.delete + condition
        );
        printQueryIfNeeded(connection.format(queryString.delete + condition));
        return result;
      }
    });
  function getCondition(query: Query) {
    if (!query || Object.keys(query).length === 0)
      throw new Error("query is empty"); // If raised, it's a bug
    const queryKeys = Object.keys(query) as K[];
    const queryIndices = queryKeys.map((key) => keys.indexOf(key));
    const queryColumns = queryIndices.map((index) => columns[index]);

    const condition = queryColumns
      .map((queryColumn, index) => {
        const value = query[queryKeys[index]];
        if (Array.isArray(value)) {
          if (value.length === 0) return "FALSE";
          else return format("?? IN (?)", [queryColumn, value]);
        } else if (value === "not null")
          return format("?? IS NOT NULL", [queryColumn]);
        else if (value === "null") return format("?? IS NULL", [queryColumn]);
        else if (typeof value === "string" && value.includes("%"))
          return format("?? LIKE ?", [queryColumn, value]);
        else return format("?? = ?", [queryColumn, value]);
      })
      .join(" AND ");
    return condition + ";";
  }
  return {
    find,
    findOne,
    save,
    saveMany,
    update,
    _delete,
    delete: _delete,
    handler,
    toObject,
    toRow,
    toPartialRow,
  };
}
const identityFunction = <T>(value: T) => value;
/**
 * @deprecated Use `crudPackage` instead
 */
export const tablePackage = <
  T extends RowDataPacket,
  C extends string = keyof T & string
>({
  columns,
  printQuery,
  tableName,
}: {
  tableName: string;
  columns: ReadonlyArray<C> | C[];
  printQuery?: boolean;
}) =>
  _crudPackage<T, T>(columns, columns, {
    table: tableName,
    printQuery,
    transfers: {
      toObject: identityFunction,
      toRow: identityFunction,
      toPartialRow: identityFunction,
    },
  });

const codes = ["ER_BAD_FIELD_ERROR", "ER_NO_SUCH_TABLE", "ER_PARSE_ERROR"];

const checkValid = ({
  columns,
  table,
  validateCheck,
}: {
  columns: string[];
  table: string;
  validateCheck?: boolean;
}) =>
  handler(async (connection) => {
    try {
      await connection.query(
        format("SELECT ?? FROM ?? LIMIT 1;", [columns, table])
      );
      return;
    } catch (e) {
      const { message, code, errno, sql, sqlState, sqlMessage } = e as any;
      log(`"${table}" is not valid table or view`);
      if (!validateCheck) {
        warn(message);
        warn(code);
        return;
      } else {
        error(message);
        error(code);
        throw e;
      }
    }
  });

export function crudPackage<
  O extends { [k in K]: any }, // Object type
  AS extends keyof O & string = never, // Auto set key string type
  K extends keyof O = keyof O // Key string type
>({
  keys,
  table,
  printQuery,
  validateCheck,
}: {
  keys: ReadonlyArray<K>;
  table: string;
  printQuery?: boolean;
  validateCheck?: boolean;
}): CrudPackage<O, any, AS, K, any>;
export function crudPackage<
  O extends { [k in K]: R[C] }, // Object type
  R extends { [c in C]: unknown }, // RowDataPacket type
  AS extends keyof O & string = never, // Auto set key string type
  K extends keyof O = keyof O, // Key string type
  C extends keyof R = keyof R // Column string type
>({
  columns,
  keys,
  table,
  printQuery,
  validateCheck,
}: {
  keys: ReadonlyArray<K>;
  columns: ReadonlyArray<C>;
  table: string;
  printQuery?: boolean;
  validateCheck?: boolean;
}): CrudPackage<O, R, AS, K, C>;
export function crudPackage<
  O extends { [k in K]: R[C] }, // Object type
  R extends { [c in C]: unknown }, // RowDataPacket type
  AS extends string = never, // Auto set key string type
  K extends keyof O = keyof O, // Key string type
  C extends keyof R = keyof R // Column string type
>(
  keys: ReadonlyArray<K>,
  columns: ReadonlyArray<C>,
  option: {
    table: string;
    printQuery?: boolean;
    transfers?: {
      toObject: (row: R) => O;
      toRow: (obj: O) => R;
      toPartialRow: (obj: Partial<O>) => Partial<R>;
    };
    autoSetColumns?: AS[];
  }
): CrudPackage<O, R, AS, K, C>;
export function crudPackage(a: any, b?: any, c?: any) {
  if (Array.isArray(a) && Array.isArray(b) && typeof c === "object")
    return _crudPackage(a as any, b as any, c);
  if (typeof a === "object") {
    const { keys, columns, table, printQuery, validateCheck } = a;
    if (
      !isArray(keys) ||
      !isOptionalArray(columns) ||
      !isString(table) ||
      !isBooleanOrUndefined(printQuery) ||
      !isBooleanOrUndefined(validateCheck)
    )
      throw new Error("Invalid arguments");
    const newColumns = columns ?? convertToSnakeStrings(keys);
    checkValid({
      columns: newColumns,
      table,
      validateCheck,
    });
    return _crudPackage(keys as any, newColumns as any, { table, printQuery });
  }
  throw new Error("Invalid arguments");
}
export function rawConverter<T, U>(fromRaw: (raw: T) => U) {
  const fromRaws = (raws: T[]) => raws.map(fromRaw);
  const fromRawOrUndefined = (raw: T | undefined) =>
    raw ? fromRaw(raw) : undefined;
  const fromRawOrNull = (raw: T | null) => (raw ? fromRaw(raw) : null);
  return { fromRaw, fromRaws, fromRawOrUndefined, fromRawOrNull };
}
