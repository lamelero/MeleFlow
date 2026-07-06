import * as admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "../config/database";
import fs from "fs";

let initialized = false;

function getCredentials(): string | null {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fromEnv) {
    console.warn("[push] WARNING: FIREBASE_SERVICE_ACCOUNT env var may leak credentials in logs/child processes. Prefer FIREBASE_SERVICE_ACCOUNT_PATH with a file.");
    return fromEnv;
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (err) {
      console.warn(`[push] could not read ${filePath}:`, (err as Error).message);
    }
  }

  return null;
}

function getMessagingInstance() {
  if (!initialized) {
    const credentialsStr = getCredentials();
    if (!credentialsStr) {
      console.warn("[push] FIREBASE_SERVICE_ACCOUNT not set, push disabled");
      return null;
    }
    try {
      const serviceAccount = JSON.parse(credentialsStr);
      admin.initializeApp({ credential: admin.cert(serviceAccount) });
      initialized = true;
      console.log("[push] Firebase initialized");
    } catch (err) {
      console.error("[push] Firebase init error:", err);
      return null;
    }
  }
  return getMessaging();
}

export async function sendPushToUser(userId: string, title: string, body: string) {
  const messaging = getMessagingInstance();
  if (!messaging) return;

  try {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title, body },
      android: {
        priority: "high",
        notification: {
          channelId: "meleflow-default",
          sound: "default",
          icon: "ic_stat_icon",
          color: "#14B8A6",
        },
      },
    });

    console.log(`[push] sent to ${response.successCount}/${tokens.length} devices`);

    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) invalidTokens.push(tokens[idx].token);
      });
      if (invalidTokens.length > 0) {
        await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
        console.log(`[push] removed ${invalidTokens.length} invalid tokens`);
      }
    }
  } catch (err) {
    console.error("[push] send error:", err);
  }
}

export async function sendPushToAll(title: string, body: string) {
  const messaging = getMessagingInstance();
  if (!messaging) return;

  try {
    const tokens = await prisma.deviceToken.findMany({ select: { token: true } });
    const tokenList = tokens.map((t) => t.token);
    if (tokenList.length === 0) return;

    for (let i = 0; i < tokenList.length; i += 500) {
      const batch = tokenList.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        android: { priority: "high" },
      });
      console.log(`[push] batch ${i / 500 + 1}: sent to ${response.successCount}/${batch.length}`);
    }
  } catch (err) {
    console.error("[push] sendAll error:", err);
  }
}
