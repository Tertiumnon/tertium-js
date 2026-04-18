import type { ApiResponse } from "../api-request/api-request.types";
import type { Filter } from "../filter/filter.types";

/**
 * Base class for a generic repository using common patterns.
 */
export abstract class Repository<T, EntityId, CreateDto, UpdateDto> {
  abstract search(filters?: Filter<unknown>[]): Promise<ApiResponse<T[]>>; // Search resources with optional filters
  abstract getOne(id: EntityId): Promise<ApiResponse<T>>; // Retrieve a single resource by ID
  abstract getMany(ids: EntityId[]): Promise<ApiResponse<T[]>>; // Retrieve multiple resources by IDs
  abstract createOne(dto: CreateDto): Promise<ApiResponse<T>>; // Add a single resource
  abstract createMany(dtos: CreateDto[]): Promise<ApiResponse<T[]>>; // Add multiple resources
  abstract updateOne(id: EntityId, dto: UpdateDto): Promise<ApiResponse<T>>; // Change a single resource
  abstract updateMany(
    dtos: { id: EntityId; dto: UpdateDto }[],
  ): Promise<ApiResponse<T[]>>; // Change multiple resources
  abstract deleteOne(id: EntityId): Promise<ApiResponse<null>>; // Delete a single resource by ID
  abstract deleteMany(ids: EntityId[]): Promise<ApiResponse<null>>; // Delete multiple resources by IDs
}
