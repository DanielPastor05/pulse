/** Next.js 15 passes dynamic segments as a promise. */
export type RouteContext<T extends Record<string, string>> = { params: Promise<T> };
