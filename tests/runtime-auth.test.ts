import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { Auth, nep413Digest } from "../apps/worker/src/auth.ts";
import { readConfig } from "../apps/worker/src/config.ts";
import { Store } from "../apps/worker/src/store.ts";

function base58(bytes: Buffer) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let remaining = BigInt(`0x${bytes.toString("hex")}`);
  let encoded = "";
  while (remaining) {
    encoded = alphabet[Number(remaining % 58n)] + encoded;
    remaining /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = "1" + encoded;
  }
  return encoded;
}

test("NEP-413 authentication rejects altered payloads, restricted keys and replay", async () => {
  const store = new Store(":memory:");
  try {
    const config = { ...readConfig(), mode: "testnet" as const };
    const accountId = "alice.testnet";
    const key = generateKeyPairSync("ed25519");
    const publicKey = `ed25519:${base58(key.publicKey.export({ type: "spki", format: "der" }).subarray(-32))}`;
    let permission: unknown = { FunctionCall: { receiver_id: "contract.testnet" } };
    const auth = new Auth(store, config, async (account, candidate) => {
      assert.equal(account, accountId);
      assert.equal(candidate, publicKey);
      return { permission };
    });
    const challenge = auth.challenge({ accountId });
    const nonce = new Uint8Array(challenge.nonce);
    const valid = sign(null, nep413Digest(challenge.message, nonce, challenge.recipient), key.privateKey).toString("base64");
    const altered = sign(null, nep413Digest(challenge.message, nonce, "other.example"), key.privateKey).toString("base64");
    const data = { challengeId: challenge.challengeId, accountId, state: challenge.state, publicKey, signature: valid };
    await assert.rejects(auth.verify({ ...data, signature: altered }), { code: "INVALID_SIGNATURE" });
    await assert.rejects(auth.verify(data), { code: "KEY_NOT_AUTHORIZED" });
    permission = "FullAccess";
    const session = await auth.verify(data);
    assert.equal(auth.session(session.token)?.accountId, accountId);
    await assert.rejects(auth.verify(data), { code: "EXPIRED_CHALLENGE" });
    auth.revoke(session.token);
    assert.equal(auth.session(session.token), null);
  } finally { store.close(); }
});
