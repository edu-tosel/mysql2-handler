import { ResultSetHeader, RowDataPacket, format, handler } from ".";
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
export function crudPackage<
  O extends { [k in K]: R[C] }, // Object type
  R extends { [c in C]: unknown }, // RowDataPacket type
  AS extends keyof O, // Auto set key string type
  K extends string | number | symbol = keyof O, // Key string type
  C extends string | number | symbol = keyof R // Column string type
>(
  keys: ReadonlyArray<K>,
  columns: ReadonlyArray<C>,
  option: {
    table: string;
    /**
     * @deprecated Use typeParam AS
     */
    autoSetKeys?: any[];
    printQuery?: boolean;
  }
) {
  const printQuery = option.printQuery || false;
  const { toObject, toPartialRow, toRow } = transfers<O, R, K, C>(
    keys,
    columns
  );
  type CompareValue<T = unknown> =
    | NonNullable<T>
    | NonNullable<T>[]
    | "null"
    | "not null"
    | `%${string}%`
    | `%${string}`
    | `${string}%`;
  type Query = { [k in K]?: CompareValue };
  type Setter = {
    [k in Exclude<K, AS>]: O[k];
  };
  const queryString = {
    selectAll: format("SELECT ?? FROM ??;", [columns, option.table]),
    selectQuery: format("SELECT ?? FROM ?? WHERE ", [columns, option.table]),
    insert: format("INSERT INTO ?? SET ?;", [option.table]),
    update: format("UPDATE ?? SET ? WHERE ", [option.table]),
    delete: format("DELETE FROM ?? WHERE ", [option.table]),
  };
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
  const find = async (query?: Query) =>
    handler(async (connection) => {
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
      if (printQuery)
        console.log(connection.format(queryString.selectQuery + condition));
      return rows.map(toObject);
    });
  const save = async (setterObj: Setter) =>
    handler(async (connection) => {
      const row = toPartialRow(setterObj as Partial<O>);
      const [result] = await connection.execute<ResultSetHeader>(
        queryString.insert,
        [row]
      );
      return result;
    });
  const update = async (setterObj: Setter, query: Query) =>
    handler(async (connection) => {
      const row = toPartialRow(setterObj as Partial<O>);
      const [result] = await connection.execute<ResultSetHeader>(
        queryString.update,
        [row, query]
      );
      if (printQuery)
        console.log(connection.format(queryString.update, [setterObj, query]));
      return result;
    });
  const _delete = async (query: Query) =>
    handler(async (connection) => {
      const condition = getCondition(query);
      const [result] = await connection.execute<ResultSetHeader>(
        queryString.delete + condition
      );
      if (printQuery)
        console.log(connection.format(queryString.delete, [query]));
      return result;
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
        if (value === "null") return format("?? IS NULL", [queryColumn]);
        else if (value === "not null")
          return format("?? IS NOT NULL", [queryColumn]);
        else if (Array.isArray(value))
          return format("?? IN (?)", [queryColumn, value]);
        else if (typeof value === "string" && value.includes("%"))
          return format("?? LIKE ?", [queryColumn, value]);
        else return format("?? = ?", [queryColumn, value]);
      })
      .join(" AND ");
    return condition + ";";
  }
  return {
    find,
    save,
    update,
    _delete,
    handler,
    toObject,
    toRow,
    toPartialRow,
  };
}
