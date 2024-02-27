import { RowDataPacket } from ".";
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
  R extends { [c in C]: V } & RowDataPacket, // RowDataPacket type
  K extends string | number | symbol = keyof O, // Key string type
  C extends string | number | symbol = keyof R, // Column string type
  V = any
>(keys: ReadonlyArray<K>, columns: ReadonlyArray<C>) {
  if (keys.length !== columns.length)
    throw new Error("keys and columns length must be same");
  const toObject = (row: R) => {
    const obj = {} as O;
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];
      const value = row[column];
      const key = keys[i];
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
