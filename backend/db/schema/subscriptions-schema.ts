import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const subscriptionsTable = pgTable("subscriptions", {
  subscriptionId: text("subscription_id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: text("strategy_id"),
  alphaConsumerAddress: varchar("alpha_consumer_address", { length: 42 }).notNull(),
  subscriptionTxHash: varchar("subscription_tx_hash", { length: 66 }).unique(),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true }).default(sql`now()`).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  alphaGeneratorAddress: varchar("alpha_generator_address", { length: 42 }),
  encryptedConsumerAddress: text("encrypted_consumer_address"),
  subscriptionType: varchar("subscription_type", { length: 20 }).default("generator"),
  encryptionVersion: integer("encryption_version").default(1),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

// Export with both names for compatibility
export const subscriptions = subscriptionsTable;

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type NewSubscription = typeof subscriptionsTable.$inferInsert;