import { useMutation } from '@tanstack/react-query'

import { useAuthStore } from '../../../shared/auth/session-store'
import { authApi } from '../api/auth.api'

export function useLogin() {
  const mutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: ({ token, refreshToken, user }) => {
      localStorage.setItem('authToken', token)
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken)
      } else {
        localStorage.removeItem('refreshToken')
      }
      localStorage.setItem('authUser', JSON.stringify(user))
      useAuthStore.setState({
        token,
        refreshToken,
        user,
        isLoading: false,
        error: null,
      })
    },
  })

  const login = async (username: string, password: string) => {
    try {
      await mutation.mutateAsync({ username, password })
      return true
    } catch {
      return false
    }
  }

  return {
    login,
    error: mutation.error instanceof Error ? mutation.error.message : null,
    isSubmitting: mutation.isPending,
    clearError: mutation.reset,
  }
}
