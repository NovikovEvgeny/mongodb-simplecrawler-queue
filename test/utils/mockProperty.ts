export function mockProperty(object: object, property: string, get?: any, set?: any) {
  Object.defineProperty(object, property, {
    get: () => get,
    set: () => set,
  });
}
