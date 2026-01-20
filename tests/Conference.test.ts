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

  it("dispatches peopleLeave event", () => {
    const session = createMockSession();
    const conf = new Conference("conf", session);

    const handler = vi.fn();
    conf.addEventListener("peopleLeave", handler);

    session.socketInteraction.emit("peopleLeave", {
      leaveId: 42,
      name: "Alice",
    });

    expect(handler).toHaveBeenCalledOnce();

    const event = handler.mock.calls[0][0];
    expect(event.detail.leaveId).toBe(42);
    expect(event.detail.name).toBe("Alice");
  });

  it("dispatches newPeople event", () => {
    const session = createMockSession();
    const conf = new Conference("conf", session);

    const handler = vi.fn();
    conf.addEventListener("newPeople", handler);

    const contact = { name: "Noan" };

    session.socketInteraction.emit("newPeople", {
      contact,
    });
    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0];
    expect(event.detail.contact).toBe(contact);
  });
});
