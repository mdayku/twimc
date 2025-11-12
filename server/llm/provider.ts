/**
 * LLM Provider Interface
 * Abstraction layer for different LLM providers (OpenAI, AWS Bedrock, etc.)
 */

export interface LlmClient {
  /**
   * Generate a demand letter draft with explanations
   */
  generateDraft(
    facts: any,
    templateMd?: string,
    firmStyle?: any
  ): Promise<{
    draft_md: string
    issues: string[]
    explanations: Record<string, string>
    input_tokens?: number
    output_tokens?: number
  }>

  /**
   * Run a critic pass to check factual support
   */
  criticPass?(
    draftMd: string,
    facts: any
  ): Promise<string[]>
}

/**
 * Shared types for LLM responses
 */
export interface LlmUsage {
  input_tokens?: number
  output_tokens?: number
}

export interface LlmDraftResult extends LlmUsage {
  draft_md: string
  issues: string[]
  explanations: Record<string, string>
}

/**
 * Provider factory function
 */
export type ProviderFactory = () => Promise<LlmClient>
