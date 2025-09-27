import { pgTable, text, timestamp, integer, jsonb, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const strategyDeliveriesTable = pgTable("strategy_deliveries", {
  deliveryId: text("delivery_id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: text("strategy_id").notNull(),
  subscriptionId: text("subscription_id").notNull(),
  consumerAddress: varchar("consumer_address", { length: 42 }).notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).default(sql`now()`).notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deliveryStatus: varchar("delivery_status", { length: 20 }).default("queued").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  errorDetails: jsonb("error_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// Export with both names for compatibility
export const strategyDeliveries = strategyDeliveriesTable;

export type StrategyDelivery = typeof strategyDeliveriesTable.$inferSelect;
export type NewStrategyDelivery = typeof strategyDeliveriesTable.$inferInsert;