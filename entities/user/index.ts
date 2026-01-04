import type { Timestamped } from '../../core/entities/src/timestamps';

export interface UserProps extends Timestamped {
  id: string;
  email: string;
  name?: string;
  phone?: number;
  role?: 'USER' | 'ADMIN' | 'MODERATOR' | string;
}

export class User implements UserProps {
  id: string;
  email: string;
  name?: string;
  phone?: number;
  role?: 'USER' | 'ADMIN' | 'MODERATOR' | string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.phone = props.phone;
    this.role = props.role ?? 'USER';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
