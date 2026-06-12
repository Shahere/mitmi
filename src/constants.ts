export const serverUrl = "https://signaling.savinienbarbotaud.fr";
//export const serverUrl = "ws://localhost:3333/ws";

export const stunServers = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ],
};
