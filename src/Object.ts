export function getPrototypeOf<T>(instance: T): T {
  return Object.getPrototypeOf(instance) as T;
}
