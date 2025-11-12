// PII Redaction utilities
// Configurable redaction for logs to protect personally identifiable information

export interface PiiRedactionConfig {
  enabled: boolean
  redactPatterns: RegExp[]
  replacement: string
}

// Default PII patterns to redact
const DEFAULT_PII_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone numbers (various formats)
  /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,

  // Social Security Numbers
  /\b\d{3}-?\d{2}-?\d{4}\b/g,

  // US Addresses (basic pattern)
  /\b\d+\s+[A-Za-z0-9\s,.-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct)\s*,?\s*[A-Za-z\s]+,?\s*\d{5}(?:-\d{4})?\b/gi,

  // Names (basic pattern - capitalized words that look like names)
  /\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?)?\s*[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,

  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // Bank account numbers (basic)
  /\b\d{8,17}\b/g,

  // Dates of birth (MM/DD/YYYY or similar)
  /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g,
]

export function createPiiRedaction(config: Partial<PiiRedactionConfig> = {}): PiiRedactionConfig {
  return {
    enabled: config.enabled ?? (process.env.PII_REDACTION_ENABLED === 'true'),
    redactPatterns: config.redactPatterns ?? DEFAULT_PII_PATTERNS,
    replacement: config.replacement ?? '[REDACTED]'
  }
}

export function redactPii(text: string, config: PiiRedactionConfig): string {
  if (!config.enabled || !text) {
    return text
  }

  let redacted = text
  for (const pattern of config.redactPatterns) {
    redacted = redacted.replace(pattern, config.replacement)
  }
  return redacted
}

export function redactObject(obj: any, config: PiiRedactionConfig): any {
  if (!config.enabled || obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    return redactPii(obj, config)
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, config))
  }

  if (typeof obj === 'object') {
    const redacted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      // Skip certain keys that are safe or needed for debugging
      if (['facts_id', 'factsId', 'template_id', 'id', 'version', 'timestamp', 'created_at', 'updated_at', 'status', 'level', 'time', 'pid', 'hostname'].includes(key)) {
        redacted[key] = value
      } else {
        redacted[key] = redactObject(value, config)
      }
    }
    return redacted
  }

  return obj
}

// Pino serializer for request bodies
export function createRequestBodySerializer(config: PiiRedactionConfig) {
  return (body: any) => redactObject(body, config)
}

// Pino serializer for response bodies
export function createResponseBodySerializer(config: PiiRedactionConfig) {
  return (body: any) => redactObject(body, config)
}

// Pino serializer for errors
export function createErrorSerializer(config: PiiRedactionConfig) {
  return (error: any) => {
    const serialized = {
      type: error.type || error.name || 'Error',
      message: error.message,
      stack: config.enabled ? undefined : error.stack, // Only include stack if redaction is disabled
      code: error.code,
      statusCode: error.statusCode
    }

    // Redact any additional properties that might contain PII
    return redactObject(serialized, config)
  }
}
