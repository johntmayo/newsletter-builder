import { Redis } from "@upstash/redis";

const CURRENT_ISSUE_KEY = "newsletter-builder:current-issue";
const USAGE_EVENTS_KEY = "newsletter-builder:usage-events";
const DEFAULT_MAX_USAGE_EVENTS = 10000;

let redisClient = null;

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
}

export function isNewsletterStorageConfigured() {
  const { url, token } = redisConfig();
  return Boolean(url && token);
}

function getRedis() {
  const { url, token } = redisConfig();
  if (!url || !token) return null;

  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

function maxUsageEvents() {
  const configured = Number.parseInt(process.env.USAGE_EVENTS_MAX || "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_USAGE_EVENTS;
}

export async function getCurrentIssue() {
  const redis = getRedis();
  if (!redis) return null;

  const record = await redis.get(CURRENT_ISSUE_KEY);
  if (!record) return null;

  // Current format is { payload, updated_at }; tolerate a raw payload during manual migrations.
  if (record.payload) {
    return {
      payload: record.payload,
      updated_at: record.updated_at || null,
    };
  }

  return {
    payload: record,
    updated_at: null,
  };
}

export async function saveCurrentIssue(payload) {
  const redis = getRedis();
  if (!redis) {
    throw new Error("Newsletter storage is not configured.");
  }

  const record = {
    payload,
    updated_at: new Date().toISOString(),
  };
  await redis.set(CURRENT_ISSUE_KEY, record);
  return record;
}

function normalizeZone(zone) {
  return typeof zone === "string" ? zone.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

/**
 * Aggregate copy/print events since `sinceMs`. The list is newest-first (LPUSH), so stop at the
 * first older event. Distinct zones stand in for "captains"; nothing identifying is returned.
 */
export function summarizeUsageEvents(events, sinceMs) {
  const zones = new Set();
  let builds = 0;
  let reachedOlder = false;
  for (const raw of events) {
    let event = raw;
    if (typeof raw === "string") {
      try {
        event = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    const t = Date.parse(event?.created_at);
    if (!Number.isFinite(t)) continue;
    if (t < sinceMs) {
      reachedOlder = true;
      break;
    }
    builds += 1;
    const zone = normalizeZone(event.zone);
    if (zone && zone !== "(none)") zones.add(zone);
  }
  return { zones, builds, reachedOlder };
}

export async function getUsageStatsSince(sinceMs, { pageSize = 250, maxScan = 5000 } = {}) {
  const redis = getRedis();
  if (!redis) return null;

  const zones = new Set();
  let builds = 0;
  for (let start = 0; start < maxScan; start += pageSize) {
    const page = await redis.lrange(USAGE_EVENTS_KEY, start, start + pageSize - 1);
    if (!page?.length) break;
    const summary = summarizeUsageEvents(page, sinceMs);
    summary.zones.forEach((z) => zones.add(z));
    builds += summary.builds;
    if (summary.reachedOlder || page.length < pageSize) break;
  }
  return { captains: zones.size, builds };
}

export async function recordUsageEvent(event) {
  const redis = getRedis();
  if (!redis) return false;

  const entry = {
    ...event,
    created_at: new Date().toISOString(),
  };

  await redis.lpush(USAGE_EVENTS_KEY, entry);
  await redis.ltrim(USAGE_EVENTS_KEY, 0, maxUsageEvents() - 1);
  return true;
}
