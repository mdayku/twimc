// OpenAI integration module for GPT demand letter generation
import OpenAI from 'openai'
import { LlmClient, LlmDraftResult } from './provider.js'

export class OpenAILlmClient implements LlmClient {
  private client: OpenAI
  private modelId: string
  private maxRetries: number
  private baseBackoffMs: number

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL, // Optional for Azure/compat endpoints
    })

    this.modelId = process.env.OPENAI_MODEL_ID || 'gpt-4'
    this.maxRetries = Number(process.env.OPENAI_MAX_RETRIES || 3)
    this.baseBackoffMs = Number(process.env.OPENAI_BACKOFF_MS || 400)

    console.log('🔍 OpenAI MODEL_ID:', this.modelId)
    console.log('🔍 OPENAI_MODEL_ID env:', process.env.OPENAI_MODEL_ID)
  }

  /**
   * Generate demand letter draft using OpenAI
   */
  async generateDraft(
    facts: any,
    templateMd?: string,
    firmStyle?: any
  ): Promise<LlmDraftResult> {
    const userPrompt = this.buildUserPrompt(facts, templateMd, firmStyle)

    try {
      // Adjust parameters based on model capabilities
      const requestParams: any = {
        model: this.modelId,
        messages: [
          { role: 'system', content: this.SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 4096,
      }

      // Some models don't support temperature adjustment
      if (this.modelId.includes('gpt-4o') || this.modelId.includes('gpt-5')) {
        requestParams.temperature = 1.0 // Use default for these models
      } else {
        requestParams.temperature = 0.3
      }

      const completion = await this.client.chat.completions.create(requestParams)

      const response = completion.choices[0]?.message?.content || ''
      const usage = completion.usage

      // Parse explanations from the response
      const explanationRegex = /\[EXPLANATION: ([^\]]+)\] ([^\n]+)/g
      const explanations: Record<string, string> = {}
      let match
      while ((match = explanationRegex.exec(response)) !== null) {
        explanations[match[1]] = match[2].trim()
      }

      // Extract the draft markdown (everything before the first explanation)
      const draftMd = response.split(/\[EXPLANATION:/)[0].trim()

      // Simple issue detection: check for TODO markers
      const issues: string[] = []
      const todoMatches = draftMd.match(/\[TODO:([^\]]+)\]/g)
      if (todoMatches && todoMatches.length > 0) {
        issues.push(`Draft contains ${todoMatches.length} TODO placeholder(s) for missing information`)
      }

      // Critic pass: check factual support for claims
      const criticIssues = await this.runCriticPass(draftMd, facts)
      issues.push(...criticIssues)

      return {
        draft_md: draftMd,
        issues,
        explanations,
        input_tokens: usage?.prompt_tokens,
        output_tokens: usage?.completion_tokens
      }
    } catch (error: any) {
      console.error('OpenAI API error:', error)

      // Fallback with placeholder template if OpenAI fails
      const fallbackDraft = this.generateFallbackDraft(facts)
      return {
        draft_md: fallbackDraft,
        issues: [`OpenAI API unavailable: ${error.message}`, 'Using fallback template'],
        explanations: {},
        input_tokens: undefined,
        output_tokens: undefined
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

  /**
   * Fallback draft template when OpenAI is unavailable
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
      const requestParams: any = {
        model: this.modelId,
        messages: [
          { role: 'system', content: 'You are a meticulous legal fact-checker. Only identify claims that lack factual support.' },
          { role: 'user', content: criticPrompt }
        ],
        max_completion_tokens: 1024,
      }

      // Some models don't support temperature adjustment
      if (this.modelId.includes('gpt-4o') || this.modelId.includes('gpt-5')) {
        requestParams.temperature = 1.0 // Use default for these models
      } else {
        requestParams.temperature = 0.1
      }

      const completion = await this.client.chat.completions.create(requestParams)

      const criticResponse = completion.choices[0]?.message?.content || ''

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
