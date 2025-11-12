/**
 * Vercel serverless handler for the Fastify app
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { app } from './index.js'

// Export the Fastify app as a Vercel serverless function
export default async (req: VercelRequest, res: VercelResponse) => {
  await app.ready()
  
  // Rewrite URL: /api/v1/intake -> /v1/intake
  const originalUrl = req.url || '/'
  if (originalUrl.startsWith('/api/')) {
    req.url = originalUrl.replace('/api', '')
  }
  
  // @ts-ignore - Fastify can handle Node.js request/response
  app.server.emit('request', req, res)
}

