export interface ApiResponseError {
  message: string;
  details?: unknown;
}

export interface ApiResponse<T, M> {
  data: T;
  meta?: M;
  errors?: ApiResponseError[];
}

export interface ApiResponseFindAllMeta {
  total: number;
  page?: number;
  pageSize?: number;
  pageCount?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  sort?: string;
  filter?: Record<string, unknown>;
  search?: string;
  nextPage?: string;
  prevPage?: string;
}

export type ApiResponseFindAll<T, M = ApiResponseFindAllMeta> = ApiResponse<T[], M>;
export type ApiResponseFindOne<T, M = undefined> = ApiResponse<T | null, M>;
export type ApiResponseCreate<T, M = undefined> = ApiResponse<T, M>;
export type ApiResponseCreateMany<T, M = undefined> = ApiResponse<T[], M>;
export type ApiResponseUpdate<T, M = undefined> = ApiResponse<T, M>;
export type ApiResponseDelete<M = undefined> = ApiResponse<null, M>;
