export interface UserProps {
  id: string;
  email: string;
  name?: string;
  phone?: number;
  role?: 'USER' | 'ADMIN' | 'MODERATOR' | string;
  createdAt?: Date;
  updatedAt?: Date;
}

export declare class User {
  id: string;
  email: string;
  name?: string;
  phone?: number;
  role?: 'USER' | 'ADMIN' | 'MODERATOR' | string;
  createdAt?: Date;
  updatedAt?: Date;
  constructor(props: UserProps);
}

export interface PostProps {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  authorId: string;
  tags?: string[];
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  status?: 'draft' | 'published' | 'archived' | string;
}

export declare class Post {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  authorId: string;
  tags?: string[];
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  status?: 'draft' | 'published' | 'archived' | string;
  constructor(props: PostProps);
}

export interface CommentProps {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export declare class Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
  constructor(props: CommentProps);
}
