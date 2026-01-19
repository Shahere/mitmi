import { vi } from "vitest";
import { describe, it, expect } from "vitest";
import { Conference } from "../src/Conference";

function createMockSession() {
  const listeners: Record<string, Function[]> = {};

  return {
    socketInteraction: {
      addEventListener: (type: string, cb: Function) => {
        listeners[type] ??= [];
        listeners[type].push(cb);
      },
      publish: vi.fn(),
      unpublish: vi.fn(),
      register: vi.fn(),
      unregister: vi.fn(),

      emit(type: string, detail: any) {
        listeners[type]?.forEach((cb) => cb({ detail }));
      },
    },
  } as any;
}

describe("Conference", () => {
  it("can be created", () => {
    const session = createMockSession();
    const conf = new Conference("test", session);

    expect(conf.name).toBe("test");
  });
});
