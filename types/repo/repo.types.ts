import type {
  ApiResponseCreate,
  ApiResponseDelete,
  ApiResponseFindAll,
  ApiResponseFindOne,
  ApiResponseUpdate,
} from "../api/api-response.types";

export interface Repo<T, EntityId, CreateDto, UpdateDto> {
  findAll(): Promise<ApiResponseFindAll<T>>;
  findOne(id: EntityId): Promise<ApiResponseFindOne<T>>;
  create(dto: CreateDto): Promise<ApiResponseCreate<T>>;
  update(id: EntityId, dto: UpdateDto): Promise<ApiResponseUpdate<T>>;
  delete(id: EntityId): Promise<ApiResponseDelete>;
}
