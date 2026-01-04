export interface Timestamped {
  createdAt?: Date;
  updatedAt?: Date;
}

export const makeTimestamps = (overrides?: Partial<Timestamped>): Timestamped => ({
  createdAt: overrides?.createdAt ?? new Date(),
  updatedAt: overrides?.updatedAt ?? new Date(),
});
