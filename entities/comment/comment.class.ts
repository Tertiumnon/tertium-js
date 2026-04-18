import type { CommentProps } from "./comment.types";

export class Comment {
  id!: string;
  postId!: string;
  authorId!: string;
  content!: string;

  constructor(props: CommentProps) {
    Object.assign(this, props);
  }
}
