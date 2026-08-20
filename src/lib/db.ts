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
      // A Promise.all of 4 reads was serialising into 2 batches at pool size 3
      // (93ms vs 52ms measured against Atlas). Idle sockets are reaped by
      // maxIdleTimeMS, so the headroom costs nothing when traffic is low.
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      // zlib ships with Node, so it always negotiates. snappy/zstd need native
      // add-ons that are not installed here, so asking for them silently gave
      // us no compression at all.
      compressors: ["zlib"],
      zlibCompressionLevel: 6,
    });
    global.__mongoClientPromise = client.connect();
  }

  return global.__mongoClientPromise;
}

export async function getDb() {
  const connectedClient = await getClientPromise();
  return connectedClient.db("ptex_webchunhiem");
}
