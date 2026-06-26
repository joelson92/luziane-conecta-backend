import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Notification } from "../models/index.js";

async function test() {
  await mongoose.connect(env.MONGODB_URI);
  try {
    const notification = await Notification.create({
      type: "BIRTHDAY",
      targetType: "SPECIFIC_USERS",
      title: "Test",
      body: "Test Body",
      data: { type: "BIRTHDAY_CONGRATULATION", userIds: [] },
      recipientIds: [],
      recipientsCount: 1,
      successCount: 0,
      failureCount: 0,
      status: "PROCESSING",
      sentAt: new Date(),
      sentBy: new mongoose.Types.ObjectId()
    });
    console.log("Success:", notification);
  } catch (error: any) {
    console.error("===== BIRTHDAY ERROR =====");
    console.error(error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}
test();
