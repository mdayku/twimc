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
    const plaintiff = facts.parties?.plaintiff || '[TODO: Plaintiff name]'
    const defendant = facts.parties?.defendant || '[TODO: Defendant name]'
    const attorney = facts.parties?.plaintiff_attorney || '[TODO: Attorney name]'
    const firm = facts.parties?.plaintiff_firm || '[TODO: Law firm]'
    const incident = facts.incident || '[TODO: Incident description]'
    const venue = facts.venue || '[TODO: Venue/Jurisdiction]'
    const amountClaimed = facts.damages?.amount_claimed || '[TODO: Total amount]'
    const incidentDate = facts.incident_date || '[TODO: Date of incident]'
    const deadlineDays = facts.demand_deadline_days || 30

    return `You are drafting a formal pre-litigation demand letter on behalf of ${plaintiff} (the injured party) against ${defendant} (the at-fault party/company).

## Case Facts:
- **Plaintiff (Injured Party):** ${plaintiff}
- **Defendant (At-Fault Party):** ${defendant}
- **Attorney:** ${attorney}
- **Law Firm:** ${firm}
- **Incident Date:** ${incidentDate}
- **Venue/Jurisdiction:** ${venue}
- **Incident Description:** ${incident}
- **Total Damages Claimed:** $${amountClaimed}
${facts.damages?.specials ? `- **Special Damages:** $${facts.damages.specials}` : ''}
${facts.damages?.generals ? `- **General Damages:** $${facts.damages.generals}` : ''}
${facts.damages?.breakdown ? `\n**Damages Breakdown:**\n${facts.damages.breakdown.map((item: any) => `  - ${item.item}: $${item.amount}`).join('\n')}` : ''}

## Your Task:
Write a complete, professional demand letter in markdown format. The letter should be 2-3 pages long and include:

1. **Letterhead/Header Block:**
   - ${firm}
   - ${attorney}, Esq.
   - [TODO: Address, phone, email if not provided]

2. **Recipient Block:**
   - ${defendant}
   - [TODO: Address - use best guess based on defendant type]
   - Date: [Use today's date]

3. **Re: Line:**
   - "Re: Demand for Settlement - ${plaintiff} v. ${defendant}"

4. **Introduction (1-2 paragraphs):**
   - State that you represent ${plaintiff}
   - Briefly describe the incident (date, location, nature)
   - State the purpose: formal demand for settlement

5. **Statement of Facts (3-5 paragraphs):**
   - Detailed narrative of what happened based on the incident description
   - Include specific details about how the incident occurred
   - Describe the defendant's role/negligence
   - Explain the immediate aftermath

6. **Liability Analysis (2-3 paragraphs):**
   - Explain why ${defendant} is legally responsible
   - Cite relevant legal theories (negligence, vicarious liability, etc.)
   - Connect the facts to the legal duty breached

7. **Injuries and Damages (2-4 paragraphs):**
   - Describe ${plaintiff}'s injuries in detail
   - Explain medical treatment received
   - Discuss impact on daily life, work, activities
   - Break down economic damages (medical bills, lost wages, etc.)
   - Discuss non-economic damages (pain, suffering, emotional distress)
   - State the total amount: $${amountClaimed}

8. **Demand (1-2 paragraphs):**
   - Formal demand for $${amountClaimed}
   - State deadline: ${deadlineDays} days from receipt
   - Mention that failure to respond may result in litigation
   - Include attorney's contact information for response

9. **Closing:**
   - Professional closing ("Sincerely,")
   - ${attorney}, Esq.
   - Attorney for ${plaintiff}

## Style Guidelines:
- Tone: ${styleNote}, assertive but not aggressive
- Use formal legal language but remain clear
- Be factual and specific - avoid hyperbole
- Cite specific damages with dollar amounts
- Make the defendant's liability clear
- Create urgency with the deadline
- **Write in complete sentences and full paragraphs - NOT bullet points or placeholders**

## CRITICAL INSTRUCTIONS:
- Write a COMPLETE letter, not an outline or template
- Use actual narrative prose, not "[TODO]" placeholders for sections you can infer
- If specific details are missing (like exact medical bills), use reasonable language like "medical expenses exceeding $X" or "substantial medical treatment"
- Make the letter persuasive and detailed enough to actually use in practice
- Return ONLY the markdown letter - no explanations or meta-commentary

${templateMd ? `\n## Template Reference:\n${templateMd.slice(0, 500)}` : ''}

Now write the complete demand letter:`
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
