import {
  ApiResponseCreate,
  ApiResponseDelete,
  ApiResponseFindAll,
  ApiResponseFindOne,
  ApiResponseUpdate,
} from "../api/api-response.types";

export interface Repo<T, CreateDto, UpdateDto> {
  findAll(): Promise<ApiResponseFindAll<T>>;
  findOne(id: string): Promise<ApiResponseFindOne<T>>;
  create(dto: CreateDto): Promise<ApiResponseCreate<T>>;
  update(id: string, dto: UpdateDto): Promise<ApiResponseUpdate<T>>;
  delete(id: string): Promise<ApiResponseDelete>;
}
