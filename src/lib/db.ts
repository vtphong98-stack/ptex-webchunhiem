import { MongoClient, ServerApiVersion } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable.");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const clientPromise = global.__mongoClientPromise ?? client.connect();

if (process.env.NODE_ENV !== "production") {
  global.__mongoClientPromise = clientPromise;
}

export async function getDb() {
  const connectedClient = await clientPromise;
  return connectedClient.db("ptex_webchunhiem");
}
