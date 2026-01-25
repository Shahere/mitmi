import { vi } from "vitest";
import { describe, it, expect } from "vitest";
import { Stream } from "../src/Stream";

describe("Conference", () => {
  it("can be created", () => {
    const mediaStream = { id: "5" } as MediaStream;
    let ownerId = "test";
    const stream = new Stream(mediaStream, ownerId, ownerId);

    expect(stream.mediastream).toBe(mediaStream);
    expect(stream.id).toBe(ownerId + "_usermedia");
  });

  it("Is local", () => {
    const mediaStream = { id: "5" } as MediaStream;
    const stream = new Stream(mediaStream, "", "");

    let isLocal = stream.isLocal();
    expect(isLocal).toBe(true);
  });

  it("Is not local", () => {
    const mediaStream = { id: "5" } as MediaStream;
    const stream = new Stream(mediaStream, "test", "test");

    let isLocal = stream.isLocal();
    expect(isLocal).toBe(false);
  });

  describe("DOM interaction", () => {
    it("Attach local to element", () => {
      const mediaStream = { id: "5" } as MediaStream;
      const stream = new Stream(mediaStream, "", "");
      stream.localMuteAudio = vi.fn();
      let domElement = {} as HTMLVideoElement;

      stream.attachToElement(domElement);
      expect(stream.domElement).toBe(domElement);
      expect(domElement.srcObject).toBe(stream.mediastream);
      expect(stream.localMuteAudio).toHaveBeenCalledOnce();
    });

    it("Attach remote to element", () => {
      const mediaStream = { id: "5" } as MediaStream;
      const stream = new Stream(mediaStream, "test", "test");
      stream.localMuteAudio = vi.fn();
      let domElement = {} as HTMLVideoElement;

      stream.attachToElement(domElement);
      expect(stream.domElement).toBe(domElement);
      expect(domElement.srcObject).toBe(stream.mediastream);
      expect(stream.localMuteAudio).toBeCalledTimes(0);
    });
  });
});
