export interface Repo<T, CreateDto, UpdateDto> {
  findAll(): Promise<T[]>;
  findOne(id: number): Promise<T>;
  create(dto: CreateDto): Promise<T>;
  update(id: number, dto: UpdateDto): Promise<T>;
  delete(id: number): Promise<void>;
  get(id: number): Promise<T>;
}
