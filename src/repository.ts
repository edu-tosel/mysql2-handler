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
  AS extends keyof O = never, // Auto set key string type
  K extends string | number | symbol = keyof O, // Key string type
  C extends string | number | symbol = keyof R // Column string type
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
  }
) {
  const printQuery = option.printQuery || false;
  const table = option.table;
  const { toObject, toPartialRow, toRow } =
    option.transfers || transfers<O, R, K, C>(keys, columns);
  type CompareValue<T = unknown> =
    | NonNullable<T>
    | NonNullable<T>[]
    | "null"
    | "not null"
    | `%${string}%`
    | `%${string}`
    | `${string}%`;
  type Query = {
    [k in K]?: CompareValue<O[k]>;
  };
  type Setter = Omit<O, AS> & { [k in AS]: never };
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
      printQueryIfNeeded(
        connection.format(queryString.selectQuery + condition)
      );
      return rows.map(toObject);
    });
  /**
   * Saves the provided setter object to the database.
   *
   * @param setterObj - The setter object containing the data to be saved.
   * @returns A promise that resolves to the result of the save operation.
   */
  const save = async (setterObj: Setter) =>
    handler(async (connection) => {
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
    });

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
  const update = async (
    setterObj: Partial<Setter>,
    query: Query,
    option?: { allowAffectAll?: boolean }
  ) =>
    handler(async (connection) => {
      const row = toPartialRow(setterObj as Partial<O>);
      if (Object.keys(row).length === 0) {
        if (option?.allowAffectAll) {
          const [result] = await connection.query<ResultSetHeader>(
            queryString.updateAll
          );
          printQueryIfNeeded(queryString.updateAll);
          return result;
        } else throw new Error("setterObj is empty");
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
  /**
   * Deletes records from the database based on the provided query.
   * @param query - The query object specifying the records to delete.
   * @param option - An optional object with additional options.
   * @param option.allowAffectAll - If set to true, allows deleting all records when the query is empty.
   * @returns A promise that resolves to the number of affected rows.
   * @throws An error if the query is empty and `option.allowAffectAll` is not set to true.
   */
  const _delete = async (query: Query, option?: { allowAffectAll?: boolean }) =>
    handler(async (connection) => {
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
          if (value.length === 0) return null;
          else return format("?? IN (?)", [queryColumn, value]);
        } else if (value === "not null")
          return format("?? IS NOT NULL", [queryColumn]);
        else if (value === "null") return format("?? IS NULL", [queryColumn]);
        else if (typeof value === "string" && value.includes("%"))
          return format("?? LIKE ?", [queryColumn, value]);
        else return format("?? = ?", [queryColumn, value]);
      })
      .filter((v) => v !== null)
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
