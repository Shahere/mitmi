import { Session } from "./Session";
import { Stream } from "./Stream";

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

let currentSession: Session | undefined = undefined;
function setCurrentSession(newSession: undefined | Session) {
  currentSession = newSession;
}
function getCurrentSession() {
  return currentSession;
}

let localStream: Stream | undefined = undefined;
function setLocalStream(newStream: undefined | Stream) {
  localStream = newStream;
}
function getLocalStream() {
  return localStream;
}

interface ContactInfo {
  id: string;
  name: string;
}

export { ContactInfo };
export { setCurrentSession };
export { getCurrentSession };
export { setLocalStream };
export { getLocalStream };
export { uidGenerator };
