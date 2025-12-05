import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { escrowApi } from '../services/escrowApi'

const STORAGE_KEY = 'escrowAuthTokens'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [tokens, setTokens] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : { client: null, admin: null }
    } catch (error) {
      console.warn('Failed to parse stored auth tokens', error)
      return { client: null, admin: null }
    }
  })
  const [loadingRole, setLoadingRole] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  }, [tokens])

  const login = async (role, password) => {
    setLoadingRole(role)
    setError(null)
    try {
      const result = await escrowApi.login({ role, password })
      setTokens(prev => ({ ...prev, [role]: result.token }))
      return result.token
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoadingRole(null)
    }
  }

  const logout = (role) => {
    setTokens(prev => ({ ...prev, [role]: null }))
  }

  const value = useMemo(() => ({
    tokens,
    loadingRole,
    error,
    login,
    logout
  }), [tokens, loadingRole, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
