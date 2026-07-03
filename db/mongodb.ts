import mongoose from "mongoose";
const DB_NAME = "william_db";

export let dbInstance: mongoose.Mongoose | null = null;
let connectingPromise: Promise<mongoose.Mongoose> | null = null;

const connectDB = async (): Promise<mongoose.Mongoose> => {
    if (dbInstance) return dbInstance;
    if (connectingPromise) return connectingPromise;

    const baseUri = process.env.MONGODB_URI;
    if (!baseUri) {
        throw new Error("Missing MONGODB_URI environment variable");
    }

    connectingPromise = mongoose
        .connect(`${baseUri}/${DB_NAME}`)
        .then((connectionInstance) => {
            dbInstance = connectionInstance;
            console.log(`\n MongoDB Connected! Db host: ${connectionInstance.connection.host}\n`);
            return connectionInstance;
        })
        .catch((error) => {
            console.error("MongoDB connection error:", error);
            // Reset promise to allow retry on next request rather than crashing the process
            connectingPromise = null;
            throw error;
        });

    return connectingPromise;
};

export default connectDB;