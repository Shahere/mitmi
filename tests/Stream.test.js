import { vi } from "vitest";
import { describe, it, expect } from "vitest";
import { Stream } from "../src/Stream";

describe("Conference", () => {
  it("can be created", () => {
    let mediaStream = { id: 5 };
    let ownerId = "test";
    const stream = new Stream(mediaStream, ownerId, ownerId);

    expect(stream.mediastream).toBe(mediaStream);
    expect(stream.id).toBe(ownerId + "_usermedia");
  });

  it("Is local", () => {
    let mediaStream = { id: 5 };
    const stream = new Stream(mediaStream, "", "");

    let isLocal = stream.isLocal();
    expect(isLocal).toBe(true);
  });

  it("Is not local", () => {
    let mediaStream = { id: 5 };
    const stream = new Stream(mediaStream, "test", "test");

    let isLocal = stream.isLocal();
    expect(isLocal).toBe(false);
  });
});
