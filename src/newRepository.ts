import { _crudPackage } from "./repository";
function crudPackage2<
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
}: {
  keys: ReadonlyArray<K>;
  columns: ReadonlyArray<C>;
  table: string;
  printQuery?: boolean;
}) {
  return _crudPackage<O, R, AS, K, C>(keys, columns, {
    table,
    printQuery,
  });
}
interface User {
  id: number;
  name: string;
  createdAt: Date;
}
interface UserRow {
  id: number;
  name: string;
  created_at: Date;
}

const keys = ["id", "name", "createdAt"] as const;
const columns = ["id", "name", "created_at"] as const;

const crud = crudPackage2<User, UserRow, "createdAt">({
  keys,
  columns,
  table: "users",
  printQuery: true,
});
crud.save({ id: 1, name: "name" });
