/** Owns one loading generation. Late results are disposed instead of reviving a retired viewer. */
export class ResourceScope {
  private active = true;
  private resources = new Set<{ dispose(): void }>();
  private pending = new Map<string, Promise<unknown>>();

  get isActive(): boolean { return this.active; }

  own<T extends { dispose(): void }>(resource: T): T {
    if (this.active) this.resources.add(resource);
    else resource.dispose();
    return resource;
  }

  load<T extends { dispose(): void }>(key: string, loader: () => Promise<T>): Promise<T | undefined> {
    if (!this.active) return Promise.resolve(undefined);
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T | undefined>;
    const promise = loader().then((resource) => {
      if (!this.active) {
        resource.dispose();
        return undefined;
      }
      this.own(resource);
      return resource;
    }).catch((error: unknown) => {
      this.pending.delete(key);
      if (this.active) throw error;
      return undefined;
    });
    this.pending.set(key, promise);
    return promise;
  }

  dispose(): void {
    if (!this.active) return;
    this.active = false;
    this.resources.forEach((resource) => resource.dispose());
    this.resources.clear();
    this.pending.clear();
  }
}
