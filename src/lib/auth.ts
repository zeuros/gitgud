import { Account } from '../models/account'

/** Get the auth key for the user. */
export function getKeyForAccount(account: Account): string {
  return getKeyForEndpoint(account.endpoint)
}

/** Get the auth key for the endpoint. */
export function getKeyForEndpoint(endpoint: string): string {
  const appName = isDev() ? 'GitHub Desktop Dev' : 'GitHub'

  return `${appName} - ${endpoint}`
}
