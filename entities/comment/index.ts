import type { Timestamped } from '../../core/entities/src/timestamps';

export interface CommentProps extends Timestamped {
  id: string;
  postId: string;
  authorId: string;
  content: string;
}

export class Comment implements CommentProps {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(props: CommentProps) {
    this.id = props.id;
    this.postId = props.postId;
    this.authorId = props.authorId;
    this.content = props.content;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
