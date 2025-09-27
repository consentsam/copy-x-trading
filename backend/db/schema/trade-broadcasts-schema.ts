import { pgTable, uuid, varchar, jsonb, timestamp, index, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { strategiesTable } from "./strategies-schema";
import { alphaGeneratorsTable } from "./alpha-generators-schema";

// Trade broadcasts table - stores strategy execution broadcasts to subscribers
export const tradeBroadcastsTable = pgTable("trade_broadcasts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: text("strategy_id").notNull(), // Changed to text to match strategies table
  alphaGeneratorId: uuid("alpha_generator_id").references(() => alphaGeneratorsTable.generatorId),
  functionName: varchar("function_name", { length: 100 }).notNull(),
  protocol: varchar("protocol", { length: 50 }).notNull(),
  parameters: jsonb("parameters").notNull(),
  contractAddress: varchar("contract_address", { length: 42 }).notNull(),
  gasEstimate: varchar("gas_estimate", { length: 100 }).notNull(),
  network: varchar("network", { length: 50 }).notNull(),
  correlationId: varchar("correlation_id", { length: 100 }).unique().notNull(),
  broadcastAt: timestamp("broadcast_at", { withTimezone: true }).default(sql`now()`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => {
  return {
    strategyIdx: index("idx_broadcasts_strategy").on(table.strategyId),
    generatorIdx: index("idx_broadcasts_generator").on(table.alphaGeneratorId),
    correlationIdx: index("idx_broadcasts_correlation").on(table.correlationId),
    expiresIdx: index("idx_broadcasts_expires").on(table.expiresAt),
  };
});

export type TradeBroadcast = typeof tradeBroadcastsTable.$inferSelect;
export type NewTradeBroadcast = typeof tradeBroadcastsTable.$inferInsert;