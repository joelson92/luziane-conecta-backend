import mongoose from "mongoose";

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/luziane-conecta";
  await mongoose.connect(mongoUri);
  console.log("Conectado ao MongoDB.");

  try {
    const users = await mongoose.connection.db!.collection("users").find(
      {},
      {
        projection: {
          name: 1,
          email: 1,
          neighborhood: 1,
          neighborhoodName: 1,
          role: 1,
          isActive: 1,
          pushToken: 1,
          expoPushToken: 1,
          fcmToken: 1,
          deviceToken: 1,
          pushTokens: 1,
          notificationToken: 1
        }
      }
    ).toArray();

    console.log("=== USUÁRIOS NO BANCO ===");
    console.dir(users, { depth: null });
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(console.error);
