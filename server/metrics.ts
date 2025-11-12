// Simple in-process metrics for MVP (no external deps)
// Stores cumulative counters and sums for durations and token usage.
// In production, export to Prometheus or a metrics backend.

type RouteKey = string

const requestCountByRoute: Map<RouteKey, number> = new Map()
const requestDurationMsSumByRoute: Map<RouteKey, number> = new Map()

let bedrockInputTokensTotal = 0
let bedrockOutputTokensTotal = 0

export function recordRequestDuration(routeKey: string, durationMs?: number) {
  const key = routeKey || 'unknown'
  requestCountByRoute.set(key, (requestCountByRoute.get(key) || 0) + 1)
  if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
    requestDurationMsSumByRoute.set(
      key,
      (requestDurationMsSumByRoute.get(key) || 0) + durationMs
    )
  }
}

export function recordBedrockTokens(inputTokens: number, outputTokens: number) {
  if (Number.isFinite(inputTokens)) bedrockInputTokensTotal += Math.max(0, Math.floor(inputTokens))
  if (Number.isFinite(outputTokens)) bedrockOutputTokensTotal += Math.max(0, Math.floor(outputTokens))
}

export function estimateTokens(text: string): number {
  // crude heuristic: ~4 chars per token
  return Math.ceil(((text || '').length) / 4)
}

export function getMetricsSnapshot() {
  const byRoute: Record<string, { count: number; avgMs?: number }> = {}
  for (const [key, count] of requestCountByRoute.entries()) {
    const sum = requestDurationMsSumByRoute.get(key)
    byRoute[key] = {
      count,
      avgMs: sum && count ? Math.round((sum / count) * 100) / 100 : undefined
    }
  }
  return {
    requests: byRoute,
    bedrock: {
      inputTokensTotal: bedrockInputTokensTotal,
      outputTokensTotal: bedrockOutputTokensTotal
    }
  }
}


