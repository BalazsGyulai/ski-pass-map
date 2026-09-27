/** Hide TODO badges and placeholders in production static builds. */
export function showDevTodo(): boolean {
  return process.env.NODE_ENV !== "production";
}
