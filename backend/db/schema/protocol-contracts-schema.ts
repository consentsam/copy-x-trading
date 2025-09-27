import { pgTable, uuid, varchar, jsonb, boolean, timestamp, text, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Protocol contracts table - stores contract addresses and ABIs for different protocols
export const protocolContractsTable = pgTable("protocol_contracts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  protocol: varchar("protocol", { length: 50 }).notNull(), // AAVE, UNISWAP
  contractName: varchar("contract_name", { length: 100 }).notNull(),
  network: varchar("network", { length: 50 }).notNull(),
  address: varchar("address", { length: 42 }).notNull(),
  abi: jsonb("abi").notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
}, (table) => {
  return {
    protocolIdx: index("idx_contracts_protocol").on(table.protocol),
    networkIdx: index("idx_contracts_network").on(table.network),
    activeIdx: index("idx_contracts_active").on(table.isActive),
  };
});

export type ProtocolContract = typeof protocolContractsTable.$inferSelect;
export type NewProtocolContract = typeof protocolContractsTable.$inferInsert;