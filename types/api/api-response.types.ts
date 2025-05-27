export interface ApiResponseError {
  message: string;
  details?: unknown;
}

export interface ApiResponse<T, M> {
  data: T;
  meta?: M;
  errors?: ApiResponseError[];
}

/**
 * Response for finding multiple resources (GET /resources)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseFindAll<User> = {
 *   data: [ { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' } ],
 *   meta: {
 *     total: 100,
 *     page: 1,
 *     pageSize: 20,
 *     pageCount: 5,
 *     hasNextPage: true,
 *     hasPreviousPage: false,
 *     sort: '-createdAt',
 *     filter: { isActive: true },
 *     search: 'alice'
 *   },
 *   errors: []
 * };
 */
/**
 * Common meta properties for paginated/find-all API responses.
 * Supports both offset-based and cursor-based pagination.
 */
export interface ApiResponseFindAllMeta {
  /** Total number of items available (across all pages) */
  total: number;
  /** Current page number (1-based) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Total number of pages */
  pageCount?: number;
  /** Are there more pages after this one? */
  hasNextPage?: boolean;
  /** Are there pages before this one? */
  hasPreviousPage?: boolean;
  /** Current sort applied */
  sort?: string;
  /** Current filter applied */
  filter?: Record<string, unknown>;
  /** Current search term */
  search?: string;
  /**
   * Cursor to fetch the next page (for cursor-based pagination)
   */
  nextPage?: string;
  /**
   * Cursor to fetch the previous page (for cursor-based pagination)
   */
  prevPage?: string;
}

export type ApiResponseFindAll<T, M = ApiResponseFindAllMeta> = ApiResponse<T[], M>;

/**
 * Response for finding a single resource (GET /resources/:id)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseFindOne<User> = {
 *   data: { id: 1, name: 'Alice' },
 *   meta: {},
 *   errors: []
 * };
 */
export type ApiResponseFindOne<T, M = undefined> = ApiResponse<T | null, M>;

/**
 * Response for creating a resource (POST /resources)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseCreate<User> = {
 *   data: { id: 3, name: 'Charlie' },
 *   meta: {},
 *   errors: []
 * };
 */
export type ApiResponseCreate<T, M = undefined> = ApiResponse<T, M>;

/**
 * Response for creating multiple resources (POST /resources/bulk)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseCreateMany<User> = {
 *   data: [
 *     { id: 3, name: 'Charlie' },
 *     { id: 4, name: 'Dana' }
 *   ],
 *   meta: {},
 *   errors: []
 * };
 */
export type ApiResponseCreateMany<T, M = undefined> = ApiResponse<T[], M>;

/**
 * Response for updating a resource (PUT/PATCH /resources/:id)
 * @example
 * type User = { id: number; name: string };
 * const response: ApiResponseUpdate<User> = {
 *   data: { id: 1, name: 'Alice Updated' },
 *   meta: {},
 *   errors: []
 * };
 */
export type ApiResponseUpdate<T, M = undefined> = ApiResponse<T, M>;

/**
 * Response for deleting a resource (DELETE /resources/:id)
 * @example
 * const response: ApiResponseDelete = {
 *   data: null,
 *   meta: { success: true },
 *   errors: []
 * };
 */
export type ApiResponseDelete<M = undefined> = ApiResponse<null, M>;
