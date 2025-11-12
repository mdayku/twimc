// Bedrock integration module for Claude demand letter generation
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
})

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0'

/**
 * System prompt for demand letter generation
 */
const SYSTEM_PROMPT = `You are a cautious legal drafting assistant. Base all assertions strictly on provided facts. If facts are missing, insert [TODO: ...] brackets. Use a concise, professional tone.

Do NOT hallucinate facts. Only use information explicitly provided in the facts JSON.
Format your response as clean markdown with clear section headings.`

/**
 * Build the user prompt for demand letter generation
 */
function buildUserPrompt(facts: any, templateMd?: string, firmStyle?: any): string {
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
 * Generate demand letter draft using AWS Bedrock Claude
 */
export async function generateWithBedrock(
  facts: any,
  templateMd?: string,
  firmStyle?: any
): Promise<{ draft_md: string; issues: string[] }> {
  const userPrompt = buildUserPrompt(facts, templateMd, firmStyle)

  // Prepare the request payload for Claude
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  }

  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    })

    const response = await client.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    // Extract the generated text from Claude's response
    const draftMd = responseBody.content?.[0]?.text || ''

    // Simple issue detection: check for TODO markers
    const issues: string[] = []
    const todoMatches = draftMd.match(/\[TODO:([^\]]+)\]/g)
    if (todoMatches && todoMatches.length > 0) {
      issues.push(`Draft contains ${todoMatches.length} TODO placeholder(s) for missing information`)
    }

    return { draft_md: draftMd, issues }
  } catch (error: any) {
    console.error('Bedrock API error:', error)
    
    // Fallback with placeholder template if Bedrock fails
    const fallbackDraft = generateFallbackDraft(facts)
    return {
      draft_md: fallbackDraft,
      issues: [`Bedrock API unavailable: ${error.message}`, 'Using fallback template'],
    }
  }
}

/**
 * Fallback draft template when Bedrock is unavailable
 */
function generateFallbackDraft(facts: any): string {
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

