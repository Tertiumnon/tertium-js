import type { ApiResponse } from "../api-request/api-request.types";
import type { Filter } from "../filter/filter.types";

/**
 * Unified interface for a generic repository using common patterns.
 */
export interface Repository<T, EntityId, CreateDto, UpdateDto> {
  search(filters?: Filter<unknown>[]): Promise<ApiResponse<T[]>>; // Search resources with optional filters
  getOne(id: EntityId): Promise<ApiResponse<T>>; // Retrieve a single resource by ID
  getMany(ids: EntityId[]): Promise<ApiResponse<T[]>>; // Retrieve multiple resources by IDs
  createOne(dto: CreateDto): Promise<ApiResponse<T>>; // Add a single resource
  createMany(dtos: CreateDto[]): Promise<ApiResponse<T[]>>; // Add multiple resources
  updateOne(id: EntityId, dto: UpdateDto): Promise<ApiResponse<T>>; // Change a single resource
  updateMany(
    dtos: { id: EntityId; dto: UpdateDto }[],
  ): Promise<ApiResponse<T[]>>; // Change multiple resources
  deleteOne(id: EntityId): Promise<ApiResponse<null>>; // Delete a single resource by ID
  deleteMany(ids: EntityId[]): Promise<ApiResponse<null>>; // Delete multiple resources by IDs
}
