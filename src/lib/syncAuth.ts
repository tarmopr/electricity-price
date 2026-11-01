/**
 * Bearer-token check shared by the sync routes (/api/sync, /api/sync/recompute).
 *
 * When SYNC_SECRET is not set (e.g. local dev), the endpoints are unauthenticated.
 * In production, set via: wrangler secret put SYNC_SECRET
 * For local dev, add SYNC_SECRET=your-value to .dev.vars (already git-ignored).
 */
export function isSyncAuthorized(request: Request): boolean {
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret) return true;
  return request.headers.get("Authorization") === `Bearer ${syncSecret}`;
}
