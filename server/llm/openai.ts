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
    
    // Calculate estimated lost wages from special damages (typically 10-20% of medical costs)
    const estimatedLostWages = facts.damages?.specials 
      ? Math.round(facts.damages.specials * 0.15) // 15% of medical expenses
      : null
    
    // Extract injuries and treatments from extracted text if available
    let injuriesInfo = ''
    let treatmentsInfo = ''
    if (facts.extracted_text && Array.isArray(facts.extracted_text)) {
      const allExtractedText = facts.extracted_text.map((et: any) => et.content).join('\n\n')
      
      // Look for injuries
      const injuryMatch = allExtractedText.match(/Injuries Reported[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|Vehicle Damage|Officer's Conclusion|$)/i)
      if (injuryMatch) {
        injuriesInfo = `\n- **Injuries from documents:** ${injuryMatch[1].trim()}`
      }
      
      // Look for treatments
      const treatmentMatch = allExtractedText.match(/(?:Treatment|Medical Care|Emergency Room)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|Follow-up|$)/i)
      if (treatmentMatch) {
        treatmentsInfo = `\n- **Treatment from documents:** ${treatmentMatch[1].trim()}`
      }
    }

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
${facts.damages?.specials ? `- **Special Damages (Medical):** $${facts.damages.specials}` : ''}
${estimatedLostWages ? `- **Estimated Lost Wages:** $${estimatedLostWages}` : ''}
${facts.damages?.generals ? `- **General Damages:** $${facts.damages.generals}` : ''}
${facts.damages?.breakdown ? `\n**Damages Breakdown:**\n${facts.damages.breakdown.map((item: any) => `  - ${item.item}: $${item.amount}`).join('\n')}` : ''}${injuriesInfo}${treatmentsInfo}

## Your Task:
Write a complete, professional demand letter in markdown format. The letter should be 2-3 pages long and include:

1. **Letterhead/Header Block (Attorney's Information):**
   - ${firm}
   - ${attorney}, Esq.
   - [FILL: Attorney's office address]
   - [FILL: Attorney's phone number]
   - Email: [FILL: Attorney's email address] (optional - omit this line if not provided)

2. **Date:**
   - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

3. **Recipient Block (Defendant's Information):**
   - ${defendant}
   - [FILL: Defendant's mailing address]

4. **Re: Line:**
   - "Re: Demand for Settlement - ${plaintiff} v. ${defendant}"

5. **Introduction (1-2 paragraphs):**
   - State that you represent ${plaintiff}
   - Briefly describe the incident (date, location, nature)
   - State the purpose: formal demand for settlement

6. **Statement of Facts (3-5 paragraphs):**
   - Detailed narrative of what happened based on the incident description
   - Include specific details about how the incident occurred
   - Describe the defendant's role/negligence
   - Explain the immediate aftermath

7. **Liability Analysis (2-3 paragraphs):**
   - Explain why ${defendant} is legally responsible
   - Cite relevant legal theories (negligence, vicarious liability, etc.)
   - Connect the facts to the legal duty breached

8. **Injuries and Damages (3-5 paragraphs):**
   - **CRITICAL:** Use the incident description to identify specific injuries mentioned (cervical sprain, shoulder sprain, concussion, broken bones, etc.)
   - Describe ${plaintiff}'s injuries in detail: specific body parts injured, severity, symptoms
   - Explain medical treatment received in detail:
     * Emergency room visit and procedures (CT scans, X-rays, medications given)
     * Follow-up care with specialists (orthopedic, neurologist, physical therapy)
     * Current treatment status and prognosis
     * Work restrictions and impact on daily activities
   - Be specific about medical findings, not generic
   
  **Economic Damages (Special Damages):**
  ${facts.damages?.specials ? `- Past medical expenses: $${facts.damages.specials}` : '- Past medical expenses: [FILL: Total medical bills to date]'}
  - Future medical expenses: [Estimate based on treatment plan - PT, follow-up visits, medications]
  ${estimatedLostWages ? `- Lost wages: $${estimatedLostWages} (estimated based on recovery time and medical treatment)` : '- Lost wages: [Estimate based on time off work and salary]'}
  - Future lost earning capacity (if applicable)
   
   **Non-Economic Damages (General Damages):**
   ${facts.damages?.generals ? `- Pain and suffering: $${facts.damages.generals}` : '- Pain and suffering: [Describe physical pain, emotional distress, loss of enjoyment of life]'}
   - Emotional distress
   - Loss of consortium (if applicable)
   
   **Total Damages: $${amountClaimed}**

9. **Demand (1-2 paragraphs):**
   - Formal demand for $${amountClaimed}
   - State deadline: ${deadlineDays} days from receipt
   - Mention that failure to respond may result in litigation
   - State: "Please direct all correspondence to my office at the address and phone number listed above."

10. **Closing:**
   - Professional closing ("Sincerely,")
   - ${attorney}, Esq.
   - ${firm}
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
- **DO NOT include section headers like "## Introduction" or "## Statement of Facts"** - write the letter as flowing prose without markdown headers
- Use actual narrative prose for sections you can write based on provided facts
- For REQUIRED information that is truly missing (addresses, phone numbers, specific medical bills, exact dates), use this format: [FILL: description of what's needed]
- Examples of [FILL] usage:
  - [FILL: Attorney's office address]
  - [FILL: Attorney's phone number]
  - [FILL: Attorney's email address] (optional)
  - [FILL: Defendant's mailing address]
  - [FILL: Specific medical bills amount]
  - [FILL: Date of medical treatment]
- Be SPECIFIC in [FILL] descriptions: "Attorney's office address" not just "Address"
- Do NOT use [FILL] for things you can reasonably infer or write generically
- Make the letter persuasive and detailed enough to actually use in practice
- Return ONLY the letter content - no section headers, no explanations, no meta-commentary
- Format the letter like an actual legal document with proper spacing between sections, but NO markdown headers

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
