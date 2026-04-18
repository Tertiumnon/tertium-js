import type { Entity } from "../../core/entity/entity.types";

export interface CommentProps extends Entity {
  postId: string;
  authorId: string;
  content: string;
}

export interface CommentCreateDto {
  postId: string;
  authorId: string;
  content: string;
}

export interface CommentUpdateDto {
  content?: string;
}
