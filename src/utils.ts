export function removeUndefined<T>(obj: T): T {
  for (const key in obj) {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  }
  return obj;
}

export const isArray = Array.isArray;
export const isOptionalArray = (value: unknown) =>
  typeof value === "undefined" || isArray(value);
export const isString = (value: unknown) => typeof value === "string";
export const isBooleanOrUndefined = (value: unknown) =>
  value === undefined || typeof value === "boolean";
export type ToSnakeCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? Rest extends Uncapitalize<Rest>
      ? `${Lowercase<First>}${ToSnakeCase<Rest>}`
      : `${Lowercase<First>}_${ToSnakeCase<Rest>}`
    : S;
export type ConvertToSnakeCase<T> = {
  [K in keyof T as ToSnakeCase<Extract<K, string>>]: T[K];
};
export const convertToSnakeString = <T extends string>(input: T) =>
  input.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() as ToSnakeCase<T>;
export const convertToSnakeStrings = <T extends string>(strings: T[]) =>
  strings.map(convertToSnakeString);
