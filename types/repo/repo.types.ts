import {
  ApiResponseCreate,
  ApiResponseDelete,
  ApiResponseFindAll,
  ApiResponseFindOne,
  ApiResponseUpdate,
} from "../api/api-response.types";

export interface Repo<T, CreateDto, UpdateDto> {
  findAll(): Promise<ApiResponseFindAll<T, unknown>>;
  findOne(id: number): Promise<ApiResponseFindOne<T, unknown>>;
  create(dto: CreateDto): Promise<ApiResponseCreate<T, unknown>>;
  update(id: string, dto: UpdateDto): Promise<ApiResponseUpdate<T, unknown>>;
  delete(id: string): ApiResponseDelete<void>;
}
