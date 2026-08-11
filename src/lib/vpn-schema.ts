import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Adjust this import to wherever Better Auth's generated schema lives in your
// existing template — the table is usually exported as `user`.
import { user } from "./auth-schema";

export const planEnum = pgEnum("plan", ["free", "pro"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
]);

// A device is one instance of your client: the Tauri desktop app on your Mac,
// or the official WireGuard app on your phone. Each has its own WireGuard
// keypair — the public key is what gets registered with a server as a peer.
export const devices = pgTable("devices", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "MacBook Air", "iPhone"
  publicKey: text("public_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at"),
});

// Your WireGuard server fleet. One row per VPS, one per region to start.
export const servers = pgTable("servers", {
  id: uuid("id").defaultRandom().primaryKey(),
  region: text("region").notNull(), // e.g. "us-phx", "eu-fra"
  hostname: text("hostname").notNull(), // public IP or DNS name
  publicKey: text("public_key").notNull(), // this server's WireGuard public key
  endpointPort: integer("endpoint_port").default(51_820).notNull(),
  subnetCidr: text("subnet_cidr").notNull(), // e.g. "10.10.0.0/24"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A peer is the join between one device and one server: "this device is
// registered on this server, at this internal tunnel IP." A device gets a
// new row here the first time it connects to a given server, so switching
// servers later doesn't require re-registering devices you've already set up.
export const peers = pgTable(
  "peers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    assignedIp: text("assigned_ip").notNull(), // e.g. "10.10.0.5/32"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => ({
    // an IP can only belong to one device per server
    uniqueIpPerServer: unique().on(table.serverId, table.assignedIp),
    // a device only ever needs one peer entry per server
    uniqueDevicePerServer: unique().on(table.deviceId, table.serverId),
  })
);

// Kept separate from the `user` table so Stripe webhooks only ever touch
// this table, never the auth schema Better Auth manages.
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  plan: planEnum("plan").default("free").notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  deviceLimit: integer("device_limit").default(1).notNull(),
  allowedRegions: jsonb("allowed_regions")
    .$type<string[] | "all">()
    .default(["us-phx"]),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations power Drizzle's relational query API, e.g.
// db.query.devices.findMany({ with: { peers: { with: { server: true } } } })
export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(user, { fields: [devices.userId], references: [user.id] }),
  peers: many(peers),
}));

export const serversRelations = relations(servers, ({ many }) => ({
  peers: many(peers),
}));

export const peersRelations = relations(peers, ({ one }) => ({
  device: one(devices, { fields: [peers.deviceId], references: [devices.id] }),
  server: one(servers, { fields: [peers.serverId], references: [servers.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(user, { fields: [subscriptions.userId], references: [user.id] }),
}));
