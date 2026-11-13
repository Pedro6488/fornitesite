import { describe, expect, it } from "vitest";
import { fnShopReceiver, friendshipCheckGate, interpretFriendAdd, interpretFriendStatus, validReceiverId } from "./fnshop-identity";
import { simulateFnShop } from "@/shared/infrastructure/fnshop/fnshop-simulator";

const now = new Date("2026-11-13T18:00:00.000Z");
const seconds = now.getTime() / 1000;
const epicId = "0123456789abcdef0123456789abcdef";

describe("FN Shop recipient names", () => {
  it("prefixes console names and leaves Epic names alone", () => {
    expect(fnShopReceiver("psn", " Jugador ")).toBe("psn:Jugador");
    expect(fnShopReceiver("xbl", "Jugador")).toBe("xbl:Jugador");
    expect(fnShopReceiver("nintendo", "Jugador")).toBe("nintendo:Jugador");
    expect(fnShopReceiver("epic", "Jugador")).toBe("Jugador");
  });
  it("keeps only well-formed Epic IDs", () => {
    expect(validReceiverId(epicId.toUpperCase())).toBe(epicId);
    expect(validReceiverId("manual:abc")).toBeNull();
  });
});

describe("friend_add", () => {
  it("leaves the customer waiting for their acceptance after a new request", () => {
    expect(interpretFriendAdd({ result: true, code: "friend_request_sent", sent: 4, receiver_id: epicId, can_gift_now: false, giftable_at: null }, now))
      .toEqual({ kind: "pending", receiverId: epicId });
  });
  it("starts the wait from the exact time FN Shop gives when they were already friends", () => {
    expect(interpretFriendAdd({ code: "already_friends", receiver_id: epicId, can_gift_now: false, giftable_at: seconds + 3600 }, now))
      .toEqual({ kind: "waiting", receiverId: epicId, giftableAt: "2026-11-13T19:00:00.000Z" });
  });
  it("marks the ID ready when gifting is already possible", () => {
    expect(interpretFriendAdd({ code: "already_friends", can_gift_now: true }, now).kind).toBe("ready");
    expect(interpretFriendAdd({ code: "already_friends", giftable_at: seconds - 60 }, now).kind).toBe("ready");
  });
  it("asks the customer to fix problems on their side without saving the ID", () => {
    const outcome = interpretFriendAdd({ result: false, code: "receiver_account_not_found" }, now);
    expect(outcome).toMatchObject({ kind: "customer_fix", code: "receiver_account_not_found" });
    expect(interpretFriendAdd({ result: false, code: "receiver_not_accepting_friends" }, now).kind).toBe("customer_fix");
  });
  it("hands anything else to the team instead of guessing", () => {
    expect(interpretFriendAdd({ result: false, code: "friends_lists_full", sent: 0 }, now)).toEqual({ kind: "manual", code: "friends_lists_full" });
    expect(interpretFriendAdd({ result: false, code: "something_new" }, now).kind).toBe("manual");
  });
  it("understands the simulator", () => {
    expect(interpretFriendAdd(simulateFnShop("friend_add", { receiver: "Jugador" }, now), now).kind).toBe("pending");
    expect(interpretFriendAdd(simulateFnShop("friend_add", { receiver: "listo" }, now), now).kind).toBe("ready");
    expect(interpretFriendAdd(simulateFnShop("friend_add", { receiver: "espera" }, now), now).kind).toBe("waiting");
  });
});

describe("friend_status", () => {
  it("is ready when any account can gift", () => {
    expect(interpretFriendStatus({ ready: 1, waiting: 3 }, now)).toEqual({ kind: "ready" });
  });
  it("uses the soonest account to set the end of the 48 hours", () => {
    const outcome = interpretFriendStatus({ ready: 0, waiting: 2, accounts: [
      { state: "friends", giftable: false, ready_in_hours: 47.5 },
      { state: "friends", giftable: false, ready_in_hours: 46 },
      { state: "pending", giftable: false, ready_in_hours: null },
    ] }, now);
    expect(outcome).toEqual({ kind: "waiting", giftableAt: "2026-11-15T16:00:00.000Z" });
  });
  it("never treats missing data as ready", () => {
    expect(interpretFriendStatus({ waiting: 1, accounts: [{ state: "friends", giftable: false }] }, now))
      .toEqual({ kind: "waiting", giftableAt: "2026-11-15T18:00:00.000Z" });
    expect(interpretFriendStatus({}, now)).toEqual({ kind: "none" });
  });
  it("reports a request that is still unaccepted", () => {
    expect(interpretFriendStatus({ ready: 0, waiting: 0, pending: 4 }, now)).toEqual({ kind: "pending" });
  });
});

describe("«Ya acepté» limits", () => {
  it("allows three checks, thirty minutes apart", () => {
    expect(friendshipCheckGate(0, null, now)).toEqual({ allowed: true });
    expect(friendshipCheckGate(1, "2026-11-13T17:20:00.000Z", now)).toEqual({ allowed: true });
    expect(friendshipCheckGate(1, "2026-11-13T17:50:00.000Z", now)).toMatchObject({ allowed: false });
    expect(friendshipCheckGate(3, null, now)).toMatchObject({ allowed: false });
  });
});
