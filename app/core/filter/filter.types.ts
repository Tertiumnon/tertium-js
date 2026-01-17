export interface Filter<T> {
  field: string; // The field to filter on
  operator: FilterOperator; // The operator to use (e.g., '=', '!=', '<', '>')
  value: T; // The value to filter by
}

export type FilterOperator =
  | "EQ"
  | "NEQ"
  | "LT"
  | "LTE"
  | "GT"
  | "GTE"
  | "IN"
  | "NOT_IN"
  | "LIKE";

export interface RangeFilter<T> {
  field: string; // The field to filter on
  from?: T; // Start of the range
  to?: T; // End of the range
}

export interface CompositeFilter<T> {
  filters: Filter<T>[]; // A collection of filters
  logic: "AND" | "OR"; // Logical operator to combine filters
}
