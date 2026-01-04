export interface Ref<T> {
  current: T | null;
}

export interface EntityRef<T> {
  id: T;
  name: string;
}
