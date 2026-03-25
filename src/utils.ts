import { Session } from "./Session";
import { Stream } from "./Stream";

/**
 * Generate a random string
 *
 * @returns - A random string format, ex: de0b1c44-b42e-c617-bcc2-14586c5fffe2
 */
function uidGenerator(): String {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (
    S4() +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    S4() +
    S4()
  );
}

/**
 * Function for global session
 */
let currentSession: Session | undefined = undefined;
function setCurrentSession(newSession: undefined | Session) {
  currentSession = newSession;
}
function getCurrentSession() {
  return currentSession;
}

export { setCurrentSession };
export { getCurrentSession };
export { uidGenerator };
