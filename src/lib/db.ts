import { drizzle } from "drizzle-orm/node-postgres";
import { user } from "./auth-schema";
import {
  devices,
  devicesRelations,
  peers,
  peersRelations,
  servers,
  serversRelations,
  subscriptions,
  subscriptionsRelations,
} from "./vpn-schema";

const schema = {
  user,
  devices,
  devicesRelations,
  peers,
  peersRelations,
  servers,
  serversRelations,
  subscriptions,
  subscriptionsRelations,
};

let db: ReturnType<typeof drizzle<typeof schema>>;

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }

    db = drizzle(databaseUrl, { schema });
  }

  return db;
}
