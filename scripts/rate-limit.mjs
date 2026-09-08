/** Fixed windows, bounded memory, fail closed when the active-key budget is exhausted. */
export function createRateLimiter({ limit, windowMs, maxKeys = 10000 }) {
  const buckets = new Map();
  return (key, now = Date.now()) => {
    for (const [id, bucket] of buckets)
      if (bucket.until <= now) buckets.delete(id);
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= maxKeys)
        return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
      bucket = { count: 0, until: now + windowMs };
      buckets.set(key, bucket);
    }
    return {
      allowed: ++bucket.count <= limit,
      retryAfter: Math.ceil((bucket.until - now) / 1000),
    };
  };
}
