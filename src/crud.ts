import { RowDataPacket } from "mysql2";
import { format, handler } from ".";

const db = "test";
const table = "users";
const columns = ["id", "name", "email"];

const queryString = {
  selectAll: format("SELECT ?? FROM ??;", [columns, `${db}.${table}`]),
  select: format("SELECT ?? FROM ?? WHERE ?;", [columns, `${db}.${table}`]),
  insertOne: format("INSERT INTO ?? SET ?;", [`${db}.${table}`]),
  insert: format("INSERT INTO ?? (??) VALUES ?;", [`${db}.${table}`, columns]),
  update: format("UPDATE ?? SET ? WHERE ?;", [`${db}.${table}`]),
  delete: format("DELETE FROM ?? WHERE ?;", [`${db}.${table}`]),
};

const find = <T extends {}>({ query }: { query: Partial<T> | Partial<T>[] }) =>
  handler(
    async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>(
        queryString.select,
        query
      );
      return rows;
    },
    { useTransaction: false }
  );
