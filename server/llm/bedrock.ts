// Bedrock integration module for Claude demand letter generation
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { estimateTokens, recordBedrockTokens } from '../metrics.js'
import { LlmClient, LlmDraftResult } from './provider.js'

export class BedrockLlmClient implements LlmClient {
  private client: BedrockRuntimeClient
  private modelId: string
  private guardrailsId: string
  private maxRetries: number
  private baseBackoffMs: number

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || 'us-east-1',
    })

    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    this.guardrailsId = process.env.BEDROCK_GUARDRAILS_ID || ''
    this.maxRetries = Number(process.env.BEDROCK_MAX_RETRIES || 3)
    this.baseBackoffMs = Number(process.env.BEDROCK_BACKOFF_MS || 400)

    console.log('🔍 Bedrock MODEL_ID:', this.modelId)
    console.log('🔍 BEDROCK_MODEL_ID env:', process.env.BEDROCK_MODEL_ID)
  }

  /**
   * Generate demand letter draft using AWS Bedrock Claude
   */
  async generateDraft(
    facts: any,
    templateMd?: string,
    firmStyle?: any
  ): Promise<LlmDraftResult> {
    const userPrompt = this.buildUserPrompt(facts, templateMd, firmStyle)

    // Prepare the request payload for Claude
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      temperature: 0.3,
      system: this.SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }

    try {
      const responseBody = await this.invokeWithRetry(payload)

      // Extract the generated text from Claude's response
      const fullResponse = responseBody.content?.[0]?.text || ''

      // Parse explanations from the response
      const explanationRegex = /\[EXPLANATION: ([^\]]+)\] ([^\n]+)/g
      const explanations: Record<string, string> = {}
      let match
      while ((match = explanationRegex.exec(fullResponse)) !== null) {
        explanations[match[1]] = match[2].trim()
      }

      // Extract the draft markdown (everything before the first explanation)
      const draftMd = fullResponse.split(/\[EXPLANATION:/)[0].trim()

      // Metrics: crude token estimates (Bedrock does not always return usage)
      const inputText = `${this.SYSTEM_PROMPT}\n\n${JSON.stringify(payload.messages)}`
      const inputTokens = estimateTokens(inputText)
      const outputTokens = estimateTokens(draftMd)
      recordBedrockTokens(inputTokens, outputTokens)

      // Simple issue detection: check for TODO markers
      const issues: string[] = []
      const todoMatches = draftMd.match(/\[TODO:([^\]]+)\]/g)
      if (todoMatches && todoMatches.length > 0) {
        issues.push(`Draft contains ${todoMatches.length} TODO placeholder(s) for missing information`)
      }

      // Critic pass: check factual support for claims
      const criticIssues = await this.runCriticPass(draftMd, facts)
      issues.push(...criticIssues)

      return { draft_md: draftMd, issues, explanations, input_tokens: inputTokens, output_tokens: outputTokens }
    } catch (error: any) {
      console.error('Bedrock API error:', error)

      // Fallback with placeholder template if Bedrock fails
      const fallbackDraft = this.generateFallbackDraft(facts)
      return {
        draft_md: fallbackDraft,
        issues: [`Bedrock API unavailable: ${error.message}`, 'Using fallback template'],
        explanations: {},
        input_tokens: estimateTokens(JSON.stringify(payload)),
        output_tokens: estimateTokens(fallbackDraft)
      }
    }
  }

  /**
   * System prompt for demand letter generation
   */
  private SYSTEM_PROMPT = `You are a cautious legal drafting assistant. Base all assertions strictly on provided facts. If facts are missing, insert [TODO: ...] brackets. Use a concise, professional tone.

Do NOT hallucinate facts. Only use information explicitly provided in the facts JSON.
Format your response as clean markdown with clear section headings.

After the demand letter, include explanations for major sections in this format:
[EXPLANATION: Introduction] Brief reason why this section was included based on the provided facts.
[EXPLANATION: Statement of Facts] Brief reason why this section was included based on the provided facts.
[EXPLANATION: Liability] Brief reason why this section was included based on the provided facts.
[EXPLANATION: Damages] Brief reason why this section was included based on the provided facts.
[EXPLANATION: Demand] Brief reason why this section was included based on the provided facts.

Guardrails:
- Do not include personal health information (PHI) or other sensitive data beyond what is explicitly present in facts.
- If the user requests disallowed content, refuse and include [TODO: requires redaction or additional authorization].`

  /**
   * Build the user prompt for demand letter generation
   */
  private buildUserPrompt(facts: any, templateMd?: string, firmStyle?: any): string {
    const styleNote = firmStyle?.tone || 'professional and firm'

    return `Generate a demand letter with the following structure:

## Facts Provided:
${JSON.stringify(facts, null, 2)}

## Required Sections:
1. Recipient block and date
2. Introduction
3. Statement of Facts (ONLY use facts from the JSON above)
4. Liability
5. Damages (specials and generals)
6. Demand with deadline
7. Exhibits list (reference any attachments mentioned in facts)

## Style:
Tone: ${styleNote}
${templateMd ? `\nTemplate guidance:\n${templateMd.slice(0, 500)}` : ''}

Return the letter as **markdown** with stable section headings (## Section Name).

CRITICAL: If any required information is missing from the facts, use [TODO: description of what is needed] placeholders.`
  }

  private async invokeWithRetry(payload: any) {
    let attempt = 0
    let lastErr: any
    while (attempt <= this.maxRetries) {
      try {
        const command = new InvokeModelCommand({
          modelId: this.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(payload),
        } as any)

        // NOTE: Native Bedrock Guardrails headers are available on certain API surfaces.
        // The v3 client for InvokeModel does not expose explicit guardrail fields; we enforce guardrails
        // via system/user prompts and validate outputs. When migrating to Converse API, attach GuardrailConfig.
        if (!this.guardrailsId) {
          // eslint-disable-next-line no-console
          console.warn('BEDROCK_GUARDRAILS_ID not set; relying on prompt-level guardrails.')
        }

        const response = await this.client.send(command)
        return JSON.parse(new TextDecoder().decode(response.body))
      } catch (err: any) {
        lastErr = err
        if (!this.isTransientError(err) || attempt === this.maxRetries) break
        const backoff = this.baseBackoffMs * Math.pow(2, attempt)
        // eslint-disable-next-line no-console
        console.warn(`Bedrock transient error, retrying in ${backoff}ms (attempt ${attempt + 1}/${this.maxRetries})`)
        await this.sleep(backoff)
        attempt++
      }
    }
    throw lastErr
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private isTransientError(err: any): boolean {
    const msg = String(err?.message || '').toLowerCase()
    const code = (err?.$metadata?.httpStatusCode as number) || 0
    if (code === 429) return true
    if (code >= 500) return true
    if (msg.includes('throttl') || msg.includes('timeout') || msg.includes('temporarily') || msg.includes('retry')) return true
    return false
  }

  /**
   * Fallback draft template when Bedrock is unavailable
   */
  private generateFallbackDraft(facts: any): string {
    const plaintiff = facts.parties?.plaintiff || '[TODO: Plaintiff name]'
    const defendant = facts.parties?.defendant || '[TODO: Defendant name]'
    const incident = facts.incident || '[TODO: Incident description]'
    const venue = facts.venue || '[TODO: Venue]'
    const damageAmount = facts.damages?.amount_claimed || '[TODO: Amount]'

    return `# Demand Letter

## Date and Recipient

Date: ${new Date().toLocaleDateString()}

To: ${defendant}
${venue}

## Introduction

This letter is written on behalf of ${plaintiff} to demand compensation for damages arising from the incident described below.

## Statement of Facts

${incident.slice(0, 800)}

## Liability

[TODO: Insert liability analysis based on provided facts]

## Damages

### Special Damages
- Amount claimed: $${damageAmount}

### General Damages
[TODO: Insert general damages calculation]

## Demand

We demand payment of $${damageAmount} within 30 days of receipt of this letter.

Failure to respond may result in legal action without further notice.

## Exhibits

${facts.exhibits?.map((ex: any, i: number) => `${i + 1}. ${ex.name}: ${ex.description}`).join('\n') || '[TODO: List exhibits]'}

---

Sincerely,

${facts.parties?.plaintiff_attorney || plaintiff}
`
  }

  /**
   * Critic pass: Review draft for factual support
   */
  private async runCriticPass(draftMd: string, facts: any): Promise<string[]> {
    const criticPrompt = `You are a legal fact-checker. Review the following demand letter draft and identify any claims, statements, or assertions that are NOT directly supported by the provided facts.

Facts provided:
${JSON.stringify(facts, null, 2)}

Demand letter draft:
${draftMd}

Instructions:
- List each unsupported claim with the exact text from the draft
- Explain why it's not supported by the facts
- If a claim is supported, do not mention it
- Focus on factual accuracy, not legal strategy or completeness
- Be specific and cite what facts are missing

Format your response as:
[UNSUPPORTED: "exact text from draft"] explanation of why it's unsupported.

If there are no unsupported claims, respond with "All claims are factually supported."`

    try {
      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        temperature: 0.1,
        system: 'You are a meticulous legal fact-checker. Only identify claims that lack factual support.',
        messages: [
          {
            role: 'user',
            content: criticPrompt,
          },
        ],
      }

      const responseBody = await this.invokeWithRetry(payload)
      const criticResponse = responseBody.content?.[0]?.text || ''

      if (criticResponse.includes('All claims are factually supported')) {
        return []
      }

      // Parse unsupported claims
      const unsupportedRegex = /\[UNSUPPORTED: "([^"]+)"\] ([^\n]+)/g
      const issues: string[] = []
      let match
      while ((match = unsupportedRegex.exec(criticResponse)) !== null) {
        issues.push(`Unsupported claim: "${match[1]}" - ${match[2]}`)
      }

      return issues
    } catch (error: any) {
      console.warn('Critic pass failed:', error.message)
      // Don't fail the whole generation if critic pass fails
      return []
    }
  }
}
