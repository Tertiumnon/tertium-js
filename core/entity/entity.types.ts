import type { Timestamped } from "../time/time.types";

/**
 * Base interface for entities with common fields.
 */
export interface Entity extends Timestamped {
  id: string; // Unique identifier
}
