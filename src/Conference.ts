import { Contact } from "./Contact";
import { Session } from "./Session";
import { Stream } from "./Stream";
import { getCurrentSession } from "./utils";

class Conference extends EventTarget {
  name: string;
  id: number;
  knownStreams: Array<Stream | void>;
  knownContact: Array<Contact | void>;
  session: Session;

  constructor(name: string, session: Session) {
    super();
    this.session = session;

    this.name = name;
    this.id = 2; //TODO change later for a random
    this.knownStreams = [];
    this.knownContact = [];
    this.setupListener();
  }

  private setupListener() {
    this.session.socketInteraction.addEventListener("stream", (e) => {
      this.newStream(e);
    });
    this.session.socketInteraction.addEventListener("peopleLeave", (e) => {
      this.peopleLeave(e);
    });
    this.session.socketInteraction.addEventListener("newPeople", (e) => {
      this.newPeople(e);
    });
  }

  publish(stream: Stream) {
    if (this.knownStreams.includes(stream)) return;

    this.knownStreams.push(stream);
    stream.conferencePublish = this;
    this.session.socketInteraction.publish(stream);
  }

  unpublish(stream: Stream) {
    if (!this.knownStreams.includes(stream)) return;

    try {
      this.session.socketInteraction.unpublish(stream);
      stream.conferencePublish = undefined;
    } catch (error) {
      return;
    }
    this.knownStreams.push(stream);
  }

  join() {
    this.session.socketInteraction.register(this.id);
  }

  leave() {
    this.session.socketInteraction.unregister();
  }
  getMembers() {}

  private newStream(e: any) {
    if (this.knownStreams.includes(e.detail.stream)) return;
    this.knownStreams.push(e.detail.stream);
    const newevent = new CustomEvent("newstream", {
      detail: {
        stream: e.detail.stream,
      },
    });
    this.dispatchEvent(newevent);
  }

  private peopleLeave(e: any) {
    const newevent = new CustomEvent("peopleLeave", {
      detail: {
        leaveId: e.detail.leaveId,
      },
    });
    console.log("[Conf] leave" + e.detail.leaveId);
    this.dispatchEvent(newevent);
  }

  private newPeople(e: any) {
    const newevent = new CustomEvent("newPeople", {
      detail: {
        contact: e.detail.contact,
      },
    });
    console.log("[Conf] join" + e.detail.contact.name);
    this.dispatchEvent(newevent);
  }
}

export { Conference };
