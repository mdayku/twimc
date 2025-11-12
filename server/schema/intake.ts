// Type definitions and validation for intake facts JSON

export interface Parties {
  plaintiff: string
  defendant: string
  plaintiff_attorney?: string
  defendant_attorney?: string
}

export interface Damages {
  amount_claimed?: number | null
  specials?: number | null
  generals?: number | null
  breakdown?: Array<{ item: string; amount: number }>
}

export interface FactsJson {
  parties: Parties
  incident: string
  damages: Damages
  venue?: string
  category?: string
  incident_date?: string
  demand_deadline_days?: number
  exhibits?: Array<{ name: string; description: string }>
}

/**
 * Basic validation for facts JSON structure
 */
export function validateFactsJson(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    errors.push('facts_json must be an object')
    return { valid: false, errors }
  }

  // Required fields
  if (!data.parties || typeof data.parties !== 'object') {
    errors.push('parties is required and must be an object')
  } else {
    if (!data.parties.plaintiff || typeof data.parties.plaintiff !== 'string') {
      errors.push('parties.plaintiff is required and must be a string')
    }
    if (!data.parties.defendant || typeof data.parties.defendant !== 'string') {
      errors.push('parties.defendant is required and must be a string')
    }
  }

  if (!data.incident || typeof data.incident !== 'string') {
    errors.push('incident is required and must be a string')
  }

  if (!data.damages || typeof data.damages !== 'object') {
    errors.push('damages is required and must be an object')
  }

  return { valid: errors.length === 0, errors }
}

