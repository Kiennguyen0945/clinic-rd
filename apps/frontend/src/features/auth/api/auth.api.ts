import type { User } from '../../../shared/auth/session-store'

interface LoginResponseData {
  token: string
  refreshToken?: string
  user: {
    id: string
    username: string
    full_name?: string
    role?: string
  }
}

interface LoginEnvelope {
  success: boolean
  data?: LoginResponseData
  message?: string
  error?: { message?: string }
}

export interface AuthSession {
  token: string
  refreshToken: string | null
  user: User
}

export class AuthApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthApiError'
  }
}

export const authApi = {
  login: async (username: string, password: string): Promise<AuthSession> => {
    let response: Response
    try {
      response = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
    } catch {
      throw new AuthApiError('Không thể kết nối máy chủ')
    }

    let payload: LoginEnvelope | null
    try {
      payload = await response.json() as LoginEnvelope
    } catch {
      payload = null
    }

    if (!response.ok || !payload?.success || !payload.data) {
      throw new AuthApiError(
        payload?.error?.message || payload?.message || 'Đăng nhập thất bại',
      )
    }

    const data = payload.data
    return {
      token: data.token,
      refreshToken: data.refreshToken || null,
      user: {
        id: data.user.id,
        username: data.user.username,
        fullName: data.user.full_name || data.user.username,
        role: (data.user.role || 'doctor').toLowerCase() as User['role'],
      },
    }
  },
}
