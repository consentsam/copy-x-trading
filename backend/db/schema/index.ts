/**
 * @file index.ts
 *
 * @description
 * Conveniently re-exports all table and type definitions in the "db/schema" folder.
 *
 * Key features:
 * - Allows importing from "@/db/schema" to access any schema.
 * - Gathers all table exports in one place.
 *
 * @notes
 * - AlphaEngine core schemas only (copy-trading platform)
 */

export * from './user-balances-schema'
export * from './placeholder'
export * from './strategies-schema'
export * from './subscriptions-schema'
export * from './strategy-deliveries-schema'
// Removed obsolete trade-confirmations-schema - using protocol-trade-confirmations-schema instead
export * from './address-mappings-schema'
export * from './alpha-generators-schema'
export * from './alpha-consumers-schema'
export * from './protocols-schema'
// New protocol strategy tables
export * from './protocol-contracts-schema'
export * from './trade-broadcasts-schema'
export * from './protocol-trade-confirmations-schema'
