import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  if (!global.__mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    global.__mongoClientPromise = client.connect();
  }

  return global.__mongoClientPromise;
}

export async function getDb() {
  const connectedClient = await getClientPromise();
  return connectedClient.db("ptex_webchunhiem");
}
