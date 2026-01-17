import type { Entity } from "../../core/entity/entity.types";
import type { PostProps } from "./post.types";

export class Post implements Entity {
  id!: string;
  title!: string;
  summary?: string;
  content?: string;
  authorId!: string;
  tags?: string[];
  publishedAt?: Date | null;
  status?: "draft" | "published" | "archived" | string;

  constructor(props: PostProps) {
    Object.assign(this, props);
  }
}
