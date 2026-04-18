import type { Entity } from "../../core/entity/entity.types";
import type { UserProps, UserRole } from "./user.types";

export class User implements Entity {
  id: string;
  email: string;
  name?: string;
  phone?: number;
  role?: UserRole;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.phone = props.phone;
    this.role = props.role;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
