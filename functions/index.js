const admin = require("firebase-admin");
const {logger} = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");

admin.initializeApp();

const db = admin.firestore();
const lineChannelAccessToken = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");

function formatDate(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function getYesterdayKey() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return formatDate(yesterday);
}

function getCreatedDate(task) {
  if (task.createdAt && typeof task.createdAt.toDate === "function") {
    return formatDate(task.createdAt.toDate());
  }
  return "0000-00-00";
}

async function pushLineMessage(token, userId, text) {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: userId,
      messages: [{type: "text", text}],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE push failed: ${response.status} ${body}`);
  }
}

exports.notifyMissedTasksToLine = onSchedule({
  schedule: "0 0 * * *",
  timeZone: "Asia/Tokyo",
  region: "asia-northeast1",
  secrets: [lineChannelAccessToken],
}, async () => {
  const token = lineChannelAccessToken.value();
  const targetDate = getYesterdayKey();
  const userRefs = await db.collection("users").listDocuments();

  await Promise.all(userRefs.map(async (userRef) => {
    const lineSettingsSnap = await userRef.collection("settings").doc("line").get();
    const lineSettings = lineSettingsSnap.exists ? lineSettingsSnap.data() : {};

    if (!lineSettings.enabled || !lineSettings.userId) return;

    const sentRef = userRef.collection("notifications").doc(`line-${targetDate}`);
    const sentSnap = await sentRef.get();
    if (sentSnap.exists) return;

    const [tasksSnap, checksSnap] = await Promise.all([
      userRef.collection("tasks").orderBy("createdAt", "asc").get(),
      userRef.collection("dailyChecks").doc(targetDate).get(),
    ]);

    const checks = checksSnap.exists ? checksSnap.data() : {};
    const missedTasks = tasksSnap.docs
      .map((taskDoc) => ({id: taskDoc.id, ...taskDoc.data()}))
      .filter((task) => getCreatedDate(task) <= targetDate)
      .filter((task) => checks[task.id] !== true);

    if (missedTasks.length === 0) {
      await sentRef.set({
        targetDate,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        missedCount: 0,
      });
      return;
    }

    const taskLines = missedTasks.map((task, index) => `${index + 1}. ${task.title}`).join("\n");
    const message = `昨日（${targetDate}）達成できなかったタスクがあります。\n\n${taskLines}`;

    await pushLineMessage(token, lineSettings.userId, message);
    await sentRef.set({
      targetDate,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      missedCount: missedTasks.length,
    });

    logger.info("Sent LINE missed-task notification", {
      uid: userRef.id,
      targetDate,
      missedCount: missedTasks.length,
    });
  }));
});
