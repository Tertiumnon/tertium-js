export interface ApiRequestFindAllParams<F = Record<string, unknown>> {
  search?: string;
  filter?: F;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface ApiRequestFindOneParams<ID = number | string> {
  id: ID;
}

export interface ApiRequestCreateParams<T = unknown> {
  data: T;
}

export interface ApiRequestUpdateParams<T = unknown, ID = number | string> {
  id: ID;
  data: Partial<T>;
}

export interface ApiRequestDeleteParams<ID = number | string> {
  id: ID;
}
