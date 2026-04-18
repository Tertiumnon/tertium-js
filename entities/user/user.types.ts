import type { Timestamped } from "../../core/time/time.types";

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
}

export interface UserProps extends Timestamped {
  id: string;
  email: string;
  name?: string;
  phone?: number;
  role?: UserRole;
}
