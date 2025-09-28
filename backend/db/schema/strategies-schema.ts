// @ts-nocheck
import { pgTable, text, varchar, boolean, timestamp, jsonb, numeric, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Single unified strategies table that supports both regular and protocol strategies
// Protocol strategies store their data in existing JSONB columns:
// - protocol → supported_protocols (as array, e.g., ["AAVE"])
// - functions → strategy_json (stores the protocol functions)
export const strategiesTable = pgTable("strategies", {
  strategyId: text("strategy_id").primaryKey().default(sql`gen_random_uuid()`),
  strategyName: varchar("strategy_name", { length: 255 }),
  strategyDescription: text("strategy_description"),
  protocol: varchar("protocol", { length: 50 }), // Added protocol column
  supportedProtocols: jsonb("supported_protocols"),
  functions: jsonb("functions"), // Added functions column
  strategyJSON: jsonb("strategy_json"),
  alphaGeneratorAddress: text("alpha_generator_address"),
  alphaGeneratorId: text("alpha_generator_id"), // Added alpha_generator_id column
  subscriberCount: integer("subscriber_count").default(0).notNull(),
  totalVolume: numeric("total_volume", { precision: 78, scale: 0 }).default("0"),
  successRate: numeric("success_rate", { precision: 5, scale: 2 }).default("0"), // Added success_rate
  totalExecutions: integer("total_executions").default(0), // Added total_executions
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// Export with both names for compatibility
export const strategies = strategiesTable;

// For backward compatibility, alias protocolStrategiesTable to strategiesTable
// This allows existing code referencing protocolStrategiesTable to continue working
export const protocolStrategiesTable = strategiesTable;

export type Strategy = typeof strategiesTable.$inferSelect;
export type NewStrategy = typeof strategiesTable.$inferInsert;
// Protocol strategy types are now same as regular strategy
export type ProtocolStrategy = Strategy;
export type NewProtocolStrategy = NewStrategy;