export interface Option<T> {
  label: string;
  value: T;
  id?: string | number;
  disabled?: boolean;
  hidden?: boolean;
  selected?: boolean;
}
