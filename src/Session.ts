import { Contact } from "./Contact";
import { Conference } from "./Conference";
import { SocketInteraction } from "./core/SocketInteraction";
import { setCurrentSession } from "./utils";

/**
 * A session represent the local connection with the server
 *
 * @remarks Singleton
 */
class Session {
  name: string;
  socketInteraction: SocketInteraction;
  contact?: Contact;
  private static session: Session;
  private static initializing?: Promise<Session>;

  /**
   * @private
   * Create a session
   *
   * @param name - Your name
   */
  private constructor(name: string) {
    this.name = name;
    this.socketInteraction = new SocketInteraction();
    this.contact = undefined;
  }

  /**
   * Create your session
   *
   * @param name - Your name
   * @returns - Your Session
   */
  static async create(name: string): Promise<Session> {
    // tout le tralala ici c'est pour eviter que React appel 2 fois create et cree 2 socket
    // Dans un cas de Singleton classique, Session est bien retourné mais pas la bonne car la socket et donc le contact ne sont pas bien initialisés
    if (Session.session && Session.session.contact) {
      setCurrentSession(Session.session);
      return Session.session;
    }

    if (Session.initializing) {
      return await Session.initializing;
    }

    Session.initializing = (async () => {
      const session = new Session(name);
      Session.session = session;

      const socketId = await session.socketInteraction.init();
      session.contact = new Contact(socketId, name);

      setCurrentSession(session);
      Session.initializing = undefined;

      return session;
    })();

    return await Session.initializing;
  }
}

export { Session };
