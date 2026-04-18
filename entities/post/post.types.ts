import type { Timestamped } from "../../core/entity/entity.types";

export interface PostProps extends Timestamped {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  authorId: string;
  tags?: string[];
  publishedAt?: Date | null;
  status?: "draft" | "published" | "archived" | string;
}
