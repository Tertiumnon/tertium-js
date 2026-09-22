import type { Filter } from "../filter/filter.types";

/**
 * Common REST API request/response types for CRUD operations.
 * These types can be extended or customized for specific use cases.
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

/**
 * Interface for API response when finding multiple resources.
 */
export interface ApiResponseFindMany<T> {
  data: T[]; // Array of resources
  total: number; // Total number of resources
  page: number; // Current page number
  pageSize: number; // Number of items per page
}

/**
 * Interface for API response when finding a single resource.
 */
export interface ApiResponseGetOne<T> {
  data: T; // The resource
}

/**
 * Interface for API response when creating a resource.
 */
export interface ApiResponseCreate<T> {
  data: T; // The created resource
}

/**
 * Interface for API response when updating a resource.
 */
export interface ApiResponseUpdate<T> {
  data: T; // The updated resource
}

/**
 * Interface for API response when deleting a resource.
 */
export type ApiResponseDelete = null;
