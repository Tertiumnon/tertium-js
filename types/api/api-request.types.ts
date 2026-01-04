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
export * from '../../core/types/api/api-request.types';
