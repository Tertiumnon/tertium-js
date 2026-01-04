import type { Timestamped } from './timestamps';

export interface PostProps extends Timestamped {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  authorId: string;
  tags?: string[];
  publishedAt?: Date | null;
  status?: 'draft' | 'published' | 'archived' | string;
}

export class Post implements PostProps {
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

  constructor(props: PostProps) {
    this.id = props.id;
    this.title = props.title;
    this.summary = props.summary;
    this.content = props.content;
    this.authorId = props.authorId;
    this.tags = props.tags ?? [];
    this.publishedAt = props.publishedAt ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
    this.status = props.status ?? 'draft';
  }
}
