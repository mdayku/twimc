// Simple in-process metrics for MVP (no external deps)
// Stores cumulative counters and sums for durations and token usage.
// In production, export to Prometheus or a metrics backend.

type RouteKey = string

const requestCountByRoute: Map<RouteKey, number> = new Map()
const requestDurationMsSumByRoute: Map<RouteKey, number> = new Map()
const requestSuccessByRoute: Map<RouteKey, number> = new Map()
const requestErrorByRoute: Map<RouteKey, number> = new Map()

let bedrockInputTokensTotal = 0
let bedrockOutputTokensTotal = 0
let openaiInputTokensTotal = 0
let openaiOutputTokensTotal = 0

let bedrockCostTotalUsd = 0
let openaiCostTotalUsd = 0

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

export function recordRequestOutcome(routeKey: string, ok: boolean) {
  const key = routeKey || 'unknown'
  if (ok) {
    requestSuccessByRoute.set(key, (requestSuccessByRoute.get(key) || 0) + 1)
  } else {
    requestErrorByRoute.set(key, (requestErrorByRoute.get(key) || 0) + 1)
  }
}

export function recordBedrockTokens(inputTokens: number, outputTokens: number) {
  if (Number.isFinite(inputTokens)) bedrockInputTokensTotal += Math.max(0, Math.floor(inputTokens))
  if (Number.isFinite(outputTokens)) bedrockOutputTokensTotal += Math.max(0, Math.floor(outputTokens))
}

export function recordOpenaiTokens(inputTokens?: number, outputTokens?: number) {
  if (Number.isFinite(inputTokens as number)) openaiInputTokensTotal += Math.max(0, Math.floor(inputTokens as number))
  if (Number.isFinite(outputTokens as number)) openaiOutputTokensTotal += Math.max(0, Math.floor(outputTokens as number))
}

export function recordLlmUsageCost(
  provider: 'openai' | 'bedrock',
  inputTokens?: number,
  outputTokens?: number
) {
  const inTok = Number(inputTokens || 0)
  const outTok = Number(outputTokens || 0)

  if (provider === 'openai') {
    const inPrice = Number(process.env.OPENAI_INPUT_PRICE_PER_1K || 0) // USD
    const outPrice = Number(process.env.OPENAI_OUTPUT_PRICE_PER_1K || 0) // USD
    const cost = (inTok / 1000) * inPrice + (outTok / 1000) * outPrice
    if (Number.isFinite(cost)) openaiCostTotalUsd += cost
  } else {
    const inPrice = Number(process.env.BEDROCK_INPUT_PRICE_PER_1K || 0) // USD
    const outPrice = Number(process.env.BEDROCK_OUTPUT_PRICE_PER_1K || 0) // USD
    const cost = (inTok / 1000) * inPrice + (outTok / 1000) * outPrice
    if (Number.isFinite(cost)) bedrockCostTotalUsd += cost
  }
}

export function estimateTokens(text: string): number {
  // crude heuristic: ~4 chars per token
  return Math.ceil(((text || '').length) / 4)
}

export function getMetricsSnapshot() {
  const byRoute: Record<string, { count: number; avgMs?: number; successes?: number; errors?: number }> = {}
  for (const [key, count] of requestCountByRoute.entries()) {
    const sum = requestDurationMsSumByRoute.get(key)
    const ok = requestSuccessByRoute.get(key) || 0
    const err = requestErrorByRoute.get(key) || 0
    byRoute[key] = {
      count,
      avgMs: sum && count ? Math.round((sum / count) * 100) / 100 : undefined,
      successes: ok,
      errors: err
    }
  }
  return {
    requests: byRoute,
    openai: {
      inputTokensTotal: openaiInputTokensTotal,
      outputTokensTotal: openaiOutputTokensTotal,
      costTotalUsd: Math.round(openaiCostTotalUsd * 10000) / 10000
    },
    bedrock: {
      inputTokensTotal: bedrockInputTokensTotal,
      outputTokensTotal: bedrockOutputTokensTotal,
      costTotalUsd: Math.round(bedrockCostTotalUsd * 10000) / 10000
    }
  }
}


