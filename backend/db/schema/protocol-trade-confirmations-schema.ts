import { pgTable, uuid, jsonb, varchar, timestamp, text, index, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tradeBroadcastsTable } from "./trade-broadcasts-schema";
import { alphaConsumersTable } from "./alpha-consumers-schema";

// Create trade confirmation status enum
export const tradeConfirmationStatusEnum = pgEnum("trade_confirmation_status", [
  "PENDING", "ACCEPTED", "REJECTED", "EXECUTING", "EXECUTED", "FAILED"
]);

// Protocol trade confirmations - tracks consumer decisions on broadcast trades
export const protocolTradeConfirmationsTable = pgTable("protocol_trade_confirmations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeBroadcastId: uuid("trade_broadcast_id").notNull().references(() => tradeBroadcastsTable.id),
  alphaConsumerId: uuid("alpha_consumer_id").notNull().references(() => alphaConsumersTable.consumerId),
  originalParameters: jsonb("original_parameters").notNull(),
  modifiedParameters: jsonb("modified_parameters").notNull(),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  gasPrice: varchar("gas_price", { length: 100 }),
  transactionHash: varchar("transaction_hash", { length: 66 }),
  errorMessage: text("error_message"),
  receivedAt: timestamp("received_at", { withTimezone: true }).default(sql`now()`),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  executedAt: timestamp("executed_at", { withTimezone: true }),
}, (table) => {
  return {
    broadcastIdx: index("idx_protocol_confirmations_broadcast").on(table.tradeBroadcastId),
    consumerIdx: index("idx_protocol_confirmations_consumer").on(table.alphaConsumerId),
    statusIdx: index("idx_protocol_confirmations_status").on(table.status),
    receivedIdx: index("idx_protocol_confirmations_received").on(table.receivedAt),
  };
});

export type ProtocolTradeConfirmation = typeof protocolTradeConfirmationsTable.$inferSelect;
export type NewProtocolTradeConfirmation = typeof protocolTradeConfirmationsTable.$inferInsert;