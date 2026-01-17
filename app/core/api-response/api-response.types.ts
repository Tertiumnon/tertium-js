export * from "../api-response/api-response.types";

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
