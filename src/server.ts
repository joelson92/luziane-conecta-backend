import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import cron from "node-cron";
import { sendTodayBirthdayCongratulations } from "./services/birthdayAutomationService.js";

await connectDatabase();

cron.schedule("0 0 * * *", async () => {
  await sendTodayBirthdayCongratulations();
}, { timezone: "America/Sao_Paulo" });

app.listen(env.PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${env.PORT}`);
  console.log(`API URL http://localhost:${env.PORT}/api`);
});
