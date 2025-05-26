export interface ApiResponseError {
  message: string;
  details?: string;
}

export interface ApiResponse<T, M> {
  data: T;
  meta: M;
}

/**
 * Response for finding multiple resources (GET /resources)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseFindAll<User> = {
 *   data: [ { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' } ],
 *   meta: { total: 2 }
 * };
 */
export type ApiResponseFindAll<T, M = undefined> = ApiResponse<T[], M>;

/**
 * Response for finding a single resource (GET /resources/:id)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseFindOne<User> = {
 *   data: { id: 1, name: 'Alice' },
 *   meta: {}
 * };
 */
export type ApiResponseFindOne<T, M = undefined> = ApiResponse<T | null, M>;

/**
 * Response for creating a resource (POST /resources)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseCreate<User> = {
 *   data: { id: 3, name: 'Charlie' },
 *   meta: {}
 * };
 */
export type ApiResponseCreate<T, M = undefined> = ApiResponse<T, M>;

/**
 * Response for updating a resource (PUT/PATCH /resources/:id)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseUpdate<User> = {
 *   data: { id: 1, name: 'Alice Updated' },
 *   meta: {}
 * };
 */
export type ApiResponseUpdate<T, M = undefined> = ApiResponse<T, M>;

/**
 * Response for deleting a resource (DELETE /resources/:id)
 * @example
 * const response: ApiResponseDelete = {
 *   data: null,
 *   meta: { success: true }
 * };
 */
export type ApiResponseDelete<M = undefined> = ApiResponse<null, M>;
