declare module '@dbg' {
  /* Log value with its source expression */
  export function dbg<T>(arg: T): T
}