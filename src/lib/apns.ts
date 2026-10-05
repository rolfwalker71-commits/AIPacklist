import { createPrivateKey, createSign } from "crypto";
import fs from "fs";
import http2 from "http2";

/**
 * Native iOS push via APNs (token-based auth, HTTP/2). No extra dependency.
 *
 * Env:
 *   APNS_KEY_ID      Key ID of the .p8 key (Apple Developer → Keys)
 *   APNS_TEAM_ID     Apple team ID
 *   APNS_KEY_PATH    Path to the .p8 file (e.g. /app/data/apns/AuthKey_XXXX.p8)
 *   APNS_KEY         Alternative: the key content (use \n for line breaks)
 *   APNS_BUNDLE_ID   App bundle ID (default ch.rolfwalker.flexipack)
 */
export type ApnsEnvironment = "sandbox" | "production";

export type ApnsMessage = {
  title: string;
  body: string;
  /** Collapses repeated notifications of the same kind. */
  collapseId?: string;
  threadId?: string;
  data?: Record<string, string>;
};

export type ApnsResult = "sent" | "stale" | "failed";

function readKey(): string | null {
  const inline = process.env.APNS_KEY?.trim();
  if (inline) return inline.replace(/\\n/g, "\n");
  const path = process.env.APNS_KEY_PATH?.trim();
  if (path && fs.existsSync(path)) return fs.readFileSync(path, "utf8");
  return null;
}

export function apnsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_ID?.trim() &&
      process.env.APNS_TEAM_ID?.trim() &&
      readKey()
  );
}

export function apnsBundleId(): string {
  return process.env.APNS_BUNDLE_ID?.trim() || "ch.rolfwalker.flexipack";
}

let cachedJwt: { token: string; issuedAt: number } | null = null;

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

/** APNs wants a fresh JWT at most every 60 minutes and at least every 20. */
function providerToken(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 45 * 60) return cachedJwt.token;

  const keyId = process.env.APNS_KEY_ID!.trim();
  const teamId = process.env.APNS_TEAM_ID!.trim();
  const key = readKey();
  if (!key) throw new Error("APNs key missing");

  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: now }));
  const signer = createSign("SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign({
    key: createPrivateKey(key),
    dsaEncoding: "ieee-p1363",
  });
  const token = `${header}.${claims}.${base64url(signature)}`;
  cachedJwt = { token, issuedAt: now };
  return token;
}

const HOSTS: Record<ApnsEnvironment, string> = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

/** One HTTP/2 session per environment, reused across notifications. */
const sessions = new Map<ApnsEnvironment, http2.ClientHttp2Session>();

function sessionFor(env: ApnsEnvironment): http2.ClientHttp2Session {
  const existing = sessions.get(env);
  if (existing && !existing.closed && !existing.destroyed) return existing;
  const session = http2.connect(HOSTS[env]);
  session.on("error", () => sessions.delete(env));
  session.on("close", () => sessions.delete(env));
  session.setTimeout(60_000, () => session.close());
  sessions.set(env, session);
  return session;
}

export function sendApns(
  deviceToken: string,
  env: ApnsEnvironment,
  message: ApnsMessage
): Promise<ApnsResult> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: ApnsResult) => {
      if (!done) {
        done = true;
        resolve(r);
      }
    };

    try {
      const session = sessionFor(env);
      const headers: http2.OutgoingHttpHeaders = {
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${providerToken()}`,
        "apns-topic": apnsBundleId(),
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": String(Math.floor(Date.now() / 1000) + 12 * 3600),
      };
      if (message.collapseId) {
        headers["apns-collapse-id"] = message.collapseId.slice(0, 64);
      }

      const req = session.request(headers);
      let status = 0;
      let raw = "";
      req.setEncoding("utf8");
      req.on("response", (h) => {
        status = Number(h[":status"] || 0);
      });
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        if (status === 200) return finish("sent");
        let reason = "";
        try {
          reason = (JSON.parse(raw) as { reason?: string }).reason || "";
        } catch {
          /* ignore */
        }
        // Token no longer valid for this app/environment: drop it.
        if (
          status === 410 ||
          reason === "BadDeviceToken" ||
          reason === "Unregistered" ||
          reason === "DeviceTokenNotForTopic"
        ) {
          return finish("stale");
        }
        console.error("[apns] failed", status, reason);
        finish("failed");
      });
      req.on("error", (e) => {
        console.error("[apns] request error", e.message);
        finish("failed");
      });
      req.setTimeout(10_000, () => {
        req.close();
        finish("failed");
      });

      req.end(
        JSON.stringify({
          aps: {
            alert: { title: message.title, body: message.body },
            sound: "default",
            ...(message.threadId ? { "thread-id": message.threadId } : {}),
          },
          ...(message.data || {}),
        })
      );
    } catch (e) {
      console.error("[apns] send error", e instanceof Error ? e.message : e);
      finish("failed");
    }
  });
}
