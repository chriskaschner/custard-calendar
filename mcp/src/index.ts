#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://custard-calendar.chris-kaschner.workers.dev";

// ---------------------------------------------------------------------------
// Client-side rate limiter (fixed-window, per-bucket)
// ---------------------------------------------------------------------------

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

const RATE_LIMITS: Record<string, number> = {
  "default":        60,   // general endpoints: 60/hour
  "nearby-flavors": 15,   // tightest — proxies Culver's upstream (Worker allows 20)
  "forecast":       60,   // Worker allows 120
  "flavor-stats":   60,   // Worker allows 120
  "metrics":        60,   // Worker allows 120
};

function checkRateLimit(bucket: string): string | null {
  const limit = RATE_LIMITS[bucket] ?? RATE_LIMITS["default"];
  const now = Date.now();
  const entry = rateBuckets.get(bucket);

  if (!entry || now >= entry.resetAt) {
    rateBuckets.set(bucket, { count: 1, resetAt: now + 3_600_000 });
    return null;
  }

  if (entry.count >= limit) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60_000);
    return `Rate limit reached for ${bucket} (${limit}/hour). Resets in ~${minutesLeft} min.`;
  }

  entry.count++;
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch(path: string, query?: Record<string, string>, bucket?: string) {
  const limitBucket = bucket ?? "default";
  const blocked = checkRateLimit(limitBucket);
  if (blocked) return { __rateLimited: true, message: blocked };

  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "custard-calendar",
  version: "1.0.0",
  description:
    "Query Flavor of the Day schedules, rarity stats, and store info for 1,000+ frozen custard shops",
});

// ---------------------------------------------------------------------------
// Tool: search_stores
// ---------------------------------------------------------------------------

server.tool(
  "search_stores",
  "Search for frozen custard stores by name, city, or state. Returns matching store slugs you can use with other tools.",
  { query: z.string().describe("City, state, or store name (e.g. 'Madison', 'WI', 'Mt. Horeb')") },
  async ({ query }) => {
    const data = await apiFetch("/api/v1/stores", { q: query }, "default");
    if (data?.__rateLimited) return text(data.message);
    if (!data?.stores?.length) return text(`No stores found for "${query}".`);
    const lines = data.stores.slice(0, 15).map(
      (s: any) => `- **${s.name}** — slug: \`${s.slug}\``
    );
    return text(`Found ${data.stores.length} stores:\n\n${lines.join("\n")}`);
  }
);

// ---------------------------------------------------------------------------
// Tool: get_todays_flavor
// ---------------------------------------------------------------------------

server.tool(
  "get_todays_flavor",
  "Get today's Flavor of the Day at a specific store, including rarity info.",
  { slug: z.string().describe("Store slug (e.g. 'mt-horeb', 'madison-wi-mineral-point-rd'). Use search_stores to find slugs.") },
  async ({ slug }) => {
    const data = await apiFetch("/api/v1/today", { slug }, "default");
    if (data?.__rateLimited) return text(data.message);
    if (!data) return text(`Could not fetch data for store: ${slug}`);
    if (!data.flavor) return text(`No flavor data available today for ${data.store || slug}. The store may be closed.`);

    let result = `**${data.store}** (${data.brand})\n`;
    result += `Today (${data.date}): **${data.flavor}**\n`;
    if (data.description) result += `\n${data.description}\n`;
    if (data.rarity?.label) {
      result += `\nRarity: ${data.rarity.label}`;
      if (data.rarity.avg_gap_days) result += ` (appears roughly every ${data.rarity.avg_gap_days} days)`;
      result += "\n";
    }
    return text(result);
  }
);

// ---------------------------------------------------------------------------
// Tool: get_week_ahead
// ---------------------------------------------------------------------------

server.tool(
  "get_week_ahead",
  "Get the upcoming flavor schedule for a store (confirmed flavors from Culver's calendar).",
  { slug: z.string().describe("Store slug") },
  async ({ slug }) => {
    const data = await apiFetch("/api/v1/flavors", { slug }, "default");
    if (data?.__rateLimited) return text(data.message);
    if (!data?.flavors?.length) return text(`No upcoming flavors found for ${slug}.`);

    const lines = data.flavors.map(
      (f: any) => `- ${f.date}: **${f.title}**${f.description ? " — " + f.description : ""}`
    );
    return text(`**${data.name}** — upcoming flavors:\n\n${lines.join("\n")}`);
  }
);

// ---------------------------------------------------------------------------
// Tool: get_flavor_stats
// ---------------------------------------------------------------------------

server.tool(
  "get_flavor_stats",
  "Get flavor history and rarity stats for a store. Optionally pass a specific flavor name for deep stats (seasonality, day-of-week patterns, streaks).",
  {
    slug: z.string().describe("Store slug"),
    flavor: z.string().optional().describe("Specific flavor name for detailed stats (e.g. 'Butter Pecan')"),
  },
  async ({ slug, flavor }) => {
    const query: Record<string, string> = {};
    if (flavor) query.flavor = flavor;
    const data = await apiFetch(`/api/v1/flavor-stats/${slug}`, query, "flavor-stats");
    if (data?.__rateLimited) return text(data.message);
    if (!data) return text(`No stats available for ${slug}.`);

    // Single-flavor deep dive
    if (flavor && data.flavor) {
      let result = `**${data.flavor}** at ${slug}:\n\n`;
      result += `- Appearances: ${data.appearances}\n`;
      if (data.avg_gap_days) result += `- Average gap: ${data.avg_gap_days} days\n`;
      if (data.last_seen) result += `- Last seen: ${data.last_seen} (${data.days_since_last} days ago)\n`;
      if (data.overdue_days > 0) result += `- **Overdue by ${data.overdue_days} days**\n`;
      if (data.seasonality?.seasonal) {
        result += `- Peak months: ${data.seasonality.peak_months.join(", ")}\n`;
      }
      if (data.dow_bias?.has_bias) {
        result += `- Most common day: ${data.dow_bias.peak_name} (${Math.round(data.dow_bias.peak_percentage * 100)}%)\n`;
      }
      if (data.stores_last_30d) result += `- Served at ${data.stores_last_30d} stores in the last 30 days\n`;
      return text(result);
    }

    // Store overview
    let result = `**${slug}** flavor profile:\n\n`;
    if (data.unique_flavors) result += `Unique flavors tracked: ${data.unique_flavors}\n\n`;
    if (data.personality?.top_families?.length) {
      result += "Top flavor families:\n";
      for (const f of data.personality.top_families.slice(0, 5)) {
        result += `- ${f.family}: ${Math.round(f.percentage * 100)}% (${f.count} times)\n`;
      }
      result += "\n";
    }
    if (data.overdue?.length) {
      result += "Overdue flavors (haven't appeared in a while):\n";
      for (const o of data.overdue) {
        result += `- ${o.flavor}: last seen ${o.last_seen} (${o.days_since} days ago)\n`;
      }
    }
    return text(result);
  }
);

// ---------------------------------------------------------------------------
// Tool: get_store_info
// ---------------------------------------------------------------------------

server.tool(
  "get_store_info",
  "Get store context: specialty flavor, observation count, and top flavors from historical data.",
  { slug: z.string().describe("Store slug") },
  async ({ slug }) => {
    const data = await apiFetch(`/api/v1/metrics/context/store/${slug}`, undefined, "metrics");
    if (data?.__rateLimited) return text(data.message);
    if (!data?.found) return text(`Store not found: ${slug}`);

    let result = `**${slug}** store context:\n\n`;
    const s = data.store;
    if (s) {
      if (s.city && s.state) result += `Location: ${s.city}, ${s.state}\n`;
      result += `Observations: ${s.observations}\n`;
      result += `Distinct flavors: ${s.distinct_flavors}\n`;
      if (s.top_flavor) result += `Most frequent flavor: ${s.top_flavor} (${s.top_flavor_count} times)\n`;
    }
    if (data.specialty_flavor) {
      const sp = data.specialty_flavor;
      result += `\nStore specialty: **${sp.title}** — served ${sp.ratio.toFixed(1)}x more often than the national average (${sp.store_count} appearances)\n`;
    }
    return text(result);
  }
);

// ---------------------------------------------------------------------------
// Tool: nearby_flavors
// ---------------------------------------------------------------------------

server.tool(
  "nearby_flavors",
  "Find what flavors are being served at stores near a location today.",
  {
    location: z.string().describe("City name, ZIP code, or 'lat,lon' coordinates"),
    flavor: z.string().optional().describe("Filter for a specific flavor (e.g. 'Butter Pecan')"),
  },
  async ({ location, flavor }) => {
    const query: Record<string, string> = { location, limit: "10" };
    if (flavor) query.flavor = flavor;
    const data = await apiFetch("/api/v1/nearby-flavors", query, "nearby-flavors");
    if (data?.__rateLimited) return text(data.message);
    if (!data) return text(`Could not find stores near "${location}".`);

    let result = "";

    if (data.matches?.length) {
      result += `Stores serving ${flavor || "matching flavors"} near ${location}:\n\n`;
      for (const m of data.matches) {
        result += `- **${m.name}** (${m.slug}): ${m.flavor} — ${m.address}\n`;
      }
      result += "\n";
    }

    if (data.nearby?.length) {
      result += `Other nearby stores:\n\n`;
      for (const n of data.nearby.slice(0, 5)) {
        result += `- **${n.name}** (${n.slug}): ${n.flavor} — ${n.address}\n`;
      }
      result += "\n";
    }

    if (data.all_flavors_today?.length) {
      result += `All flavors nearby today: ${data.all_flavors_today.join(", ")}\n`;
    }

    return text(result || `No flavor data found near "${location}".`);
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Custard Calendar MCP server running");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
