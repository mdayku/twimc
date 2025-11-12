'use client'

import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import toast from 'react-hot-toast'

interface GoogleAuthButtonProps {
  onSuccess: (accessToken: string) => void
  onError?: (error: Error) => void
}

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  if (!clientId || clientId === 'your-google-client-id-here') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800">
          <strong>Google OAuth not configured.</strong> Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your .env.local file.
        </p>
      </div>
    )
  }

  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>
}

export default function GoogleAuthButton({ onSuccess, onError }: GoogleAuthButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  if (!clientId || clientId === 'your-google-client-id-here') {
    return (
      <button
        disabled
        className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-md text-base font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
      >
        Configure Google OAuth First
      </button>
    )
  }

  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      // Exchange the credential for an access token
      // Note: In production, you'd want to do this server-side
      const params = new URLSearchParams()
      if (credentialResponse.credential) {
        params.append('code', credentialResponse.credential)
      }
      params.append('client_id', clientId)
      params.append('grant_type', 'authorization_code')
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      })

      if (!response.ok) {
        throw new Error('Failed to exchange token')
      }

      const data = await response.json()
      onSuccess(data.access_token)
      toast.success('Connected to Google')
    } catch (error) {
      console.error('Google auth error:', error)
      toast.error('Failed to authenticate with Google')
      onError?.(error as Error)
    }
  }

  const handleError = () => {
    toast.error('Google authentication failed')
    onError?.(new Error('Authentication failed'))
  }

  return (
    <div>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap={false}
      />
    </div>
  )
}

