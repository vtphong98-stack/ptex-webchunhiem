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
      // Atlas bầu lại primary mất chừng 5–10 giây. Để cửa sổ 5s thì đúng lúc
      // đó mọi trang dựng ở máy chủ đều gãy — đã gặp thật, trang tra cứu học
      // sinh đổ ra "Minified React error #441". 12s vẫn nằm trong hạn mức của
      // hàm trên Vercel mà đủ qua một lần bầu lại.
      serverSelectionTimeoutMS: 12000,
      connectTimeoutMS: 12000,
      socketTimeoutMS: 20000,
      // zlib ships with Node, so it always negotiates. snappy/zstd need native
      // add-ons that are not installed here, so asking for them silently gave
      // us no compression at all.
      compressors: ["zlib"],
      zlibCompressionLevel: 6,
    });
    // Giữ lại một lời hứa đã hỏng là hỏng luôn cả tiến trình: Atlas chớp một
    // nhịp lúc kết nối đầu tiên, thế là mọi lượt dựng trang sau đó đều ném lại
    // đúng lỗi cũ cho tới khi khởi động lại máy chủ. Hỏng thì bỏ đi để lượt sau
    // nối lại từ đầu.
    global.__mongoClientPromise = client.connect().catch((error: unknown) => {
      global.__mongoClientPromise = undefined;
      void client.close().catch(() => {});
      throw error;
    });
  }

  return global.__mongoClientPromise;
}

export async function getDb() {
  const connectedClient = await getClientPromise();
  return connectedClient.db("ptex_webchunhiem");
}
