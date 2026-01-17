import type { Filter } from "../filter/filter.types";

/**
 * Common API request types for CRUD operations.
 * These types can be extended or customized for specific use cases.
 */

/**
 * Request for finding multiple resources (GET /resources)
 * @example
 * const params: ApiRequestFindMany = {
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
 * const params: ApiRequestFindMany<UserFilter> = {
 *   search: 'alice',
 *   filter: { isActive: true },
 *   sort: '-createdAt',
 *   page: 1,
 *   pageSize: 20
 * };
 */

/**
 * Interface for API request parameters to find multiple resources.
 */
export interface ApiRequestFindManyParams {
  search?: string; // Search query
  filters?: Filter<unknown>[]; // Support for multiple filters
  sort?: string; // Sorting field
}

/**
 * Interface for API request parameters to find a single resource.
 */
export interface ApiRequestGetOneParams {
  id: string; // Unique identifier of the resource
}

/**
 * Interface for API request parameters to create a resource.
 */
export interface ApiRequestCreateParams<T> {
  data: T; // Data for the new resource
}

/**
 * Interface for API request parameters to update a resource.
 */
export interface ApiRequestUpdateParams<T> {
  id: string; // Unique identifier of the resource
  data: Partial<T>; // Partial data to update the resource
}

/**
 * Interface for API request parameters to delete a resource.
 */
export interface ApiRequestDeleteParams {
  id: string; // Unique identifier of the resource
}

/**
 * Interface for API response.
 */
export interface ApiResponse<T> {
  data: T;
  filters?: Record<string, unknown>[]; // Support for multiple filters
  message?: string;
}
