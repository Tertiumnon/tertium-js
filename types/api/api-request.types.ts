/**
 * Common API request types for CRUD operations.
 * These types can be extended or customized for specific use cases.
 */

/**
 * Request for finding multiple resources (GET /resources)
 * @example
 * const params: ApiRequestFindAll = {
 *   filter: { name: 'Alice' },
 *   sort: 'createdAt',
 *   page: 1,
 *   pageSize: 20
 * };
 */
/**
 * Request for finding multiple resources with common filtering, searching, and pagination options.
 *
 * @example
 * const params: ApiRequestFindAll<UserFilter> = {
 *   search: 'alice',
 *   filter: { isActive: true },
 *   sort: '-createdAt',
 *   page: 1,
 *   pageSize: 20
 * };
 */
export interface ApiRequestFindAllParams<F = Record<string, unknown>> {
  /**
   * Free-text search across multiple fields.
   * Example: 'alice'
   */
  search?: string;

  /**
   * Field-based filtering, e.g., { isActive: true }
   */
  filter?: F;
  /**
   * Sort by field. Prefix with '-' for descending. Example: '-createdAt'
   */
  sort?: string;
  /**
   * Page number (1-based)
   */
  page?: number;
  /**
   * Number of items per page
   */
  pageSize?: number;
}

/**
 * Request for finding a single resource (GET /resources/:id)
 * @example
 * const params: ApiRequestFindOne = { id: 1 };
 */
export interface ApiRequestFindOneParams<ID = number | string> {
  id: ID;
}

/**
 * Request for creating a resource (POST /resources)
 * @example
 * const body: ApiRequestCreate<User> = {
 *   data: { name: 'Charlie' }
 * };
 */
export interface ApiRequestCreateParams<T = unknown> {
  data: T;
}

/**
 * Request for updating a resource (PUT/PATCH /resources/:id)
 * @example
 * const body: ApiRequestUpdate<User> = {
 *   id: 1,
 *   data: { name: 'Alice Updated' }
 * };
 */
export interface ApiRequestUpdateParams<T = unknown, ID = number | string> {
  id: ID;
  data: Partial<T>;
}

/**
 * Request for deleting a resource (DELETE /resources/:id)
 * @example
 * const params: ApiRequestDelete = { id: 1 };
 */
export interface ApiRequestDeleteParams<ID = number | string> {
  id: ID;
}
