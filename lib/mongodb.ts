import { MongoClient } from "mongodb";

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export function getMongoClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === "" || uri === "undefined" || uri === "null" || (!uri.startsWith("mongodb+srv://") && !uri.startsWith("mongodb://")) || uri.includes("your-mongodb-connection-string") || uri.includes("placeholder")) {
    throw new Error("MONGODB_URI environment variable is missing or invalid. Please set your MongoDB Atlas connection string in your Vercel or local .env file.");
  }

  if (clientPromise) {
    return clientPromise;
  }

  const options = {};
  
  if (process.env.NODE_ENV === "development") {
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb() {
  const connection = await getMongoClientPromise();
  return connection.db();
}
