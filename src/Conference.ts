import { Contact } from "./Contact";
import { Session } from "./Session";
import { Stream } from "./Stream";
import { getCurrentSession } from "./utils";

/**
 * A Conference is a group of Contact joining eachother
 */
class Conference extends EventTarget {
  name: string;
  id: number;
  knownStreams: Array<Stream | void>;
  knownContact: Array<Contact | void>;
  session: Session;

  /**
   *
   * @param name - Name of the conference
   * @param session - Your session will be use to interact with the server
   */
  constructor(name: string, session: Session) {
    super();
    this.session = session;

    this.name = name;
    this.id = 2; //TODO change later for a random
    this.knownStreams = [];
    this.knownContact = [];
    this.setupListener();
  }

  /**
   * Call when creating a conference
   *
   * @private
   */
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

  /**
   * Publish a steam in the conference only one at the moment
   *
   * @param stream - A Stream
   * @returns void
   */
  publish(stream: Stream) {
    if (this.knownStreams.includes(stream)) return;

    this.knownStreams.push(stream);
    stream.conferencePublish = this;
    this.session.socketInteraction.publish(stream);
  }

  /**
   * Unpublish stream
   *
   * @param stream - A published Stream
   * @returns void
   */
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

  /**
   * Join the conference
   */
  join() {
    this.session.socketInteraction.register(this.id);
  }

  /**
   * Leave the conference
   */
  leave() {
    this.session.socketInteraction.unregister();
  }

  /**
   * Get all member of the conference
   *
   */
  getMembers() {}

  /**
   * Call when a new stream is available in the conference
   *
   * @param e - event
   * @returns void
   * @event
   */
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

  /**
   * Call when a member leave the conference
   *
   * @param e - event
   * @event
   */
  private peopleLeave(e: any) {
    const newevent = new CustomEvent("peopleLeave", {
      detail: {
        leaveId: e.detail.leaveId,
      },
    });
    console.log("[Conf] leave" + e.detail.leaveId);
    this.dispatchEvent(newevent);
  }

  /**
   * Call when a member join the conference
   *
   * @param e - event
   * @event
   */
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
