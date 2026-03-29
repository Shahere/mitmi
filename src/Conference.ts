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
  knownStreams: Array<Stream>;
  knownContact: Array<Contact>;
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
    this.session.socketInteraction.addEventListener("streamEnded", (e) => {
      if (this.knownStreams.length < 0) return;
      const streamToRemove = this.knownStreams.filter((stream) => {
        if (!stream) return;
        return (
          stream.id ==
          (<CustomEvent>e).detail.remoteUserId +
            (<CustomEvent>e).detail.stream.id
        );
      });
      if (streamToRemove) {
        this.streamEnded(streamToRemove[0]!);
      }
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
   * @returns List of contact active in the conference
   */
  getMembers(): Contact[] {
    return this.knownContact;
  }

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
    const leaveContactId = e.detail.leaveId;
    const newevent = new CustomEvent("peopleLeave", {
      detail: {
        leaveId: e.detail.leaveId,
        name: e.detail.name,
      },
    });
    const contactToRemove = this.knownContact.filter(
      (contact) => contact.id === leaveContactId,
    );
    const index = this.knownContact.indexOf(contactToRemove[0]);
    if (index > -1) {
      this.knownContact.splice(index, 1);
      this.dispatchEvent(newevent);
    }
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
    this.knownContact.push(e.detail.contact);
    console.log("[Conf] join : " + e.detail.contact.name);
    this.dispatchEvent(newevent);
  }

  /**
   * Call when a stream in conference has ended
   *
   * @param e - event
   * @event
   */
  private streamEnded(streamEnd: Stream) {
    const newevent = new CustomEvent("streamEnded", {
      detail: {
        stream: streamEnd,
      },
    });
    console.log("[Conf] stream ended : " + streamEnd);
    this.dispatchEvent(newevent);
  }
}

export { Conference };
