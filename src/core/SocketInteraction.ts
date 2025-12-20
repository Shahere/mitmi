import { io, Socket } from "socket.io-client";
import { serverUrl } from "../constants";
import { getCurrentSession } from "../utils";
import { Stream, StreamParams } from "../Stream";
import { ContactInfo } from "../utils";

interface SocketMessage {
  from: ContactInfo;
  target?: string;
  payload: {
    action: "join" | "offer" | "answer" | "ice" | "close";
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidate;
    message?: string;
    disconnect?: string;
  };
}

export class SocketInteraction extends EventTarget {
  private socket!: Socket;
  private _userId?: string;
  private _confId?: number;
  private localStream?: Stream;
  private senders: Array<RTCRtpSender> = [];

  private peerConnections: Record<string, RTCPeerConnection> = {};

  async init(): Promise<string> {
    this.socket = io(serverUrl, {});

    console.warn("WS transport");

    return new Promise((resolve, reject) => {
      this.socket.once("connect", () => {
        this._userId = this.socket.id;
        this.setupSocketListeners();
        resolve(this._userId!);
      });

      this.socket.once("connect_error", reject);
      this.socket.once("error", reject);
    });
  }

  get userId(): string {
    if (!this._userId) throw new Error("Socket not connected yet");
    return this._userId;
  }

  publish(stream: Stream) {
    this.localStream = stream;

    Object.values(this.peerConnections).forEach((pc) => {
      this.attachStreamToPeer(pc);
    });

    console.log("[RTC] Stream published to all peers");
  }

  unpublish(stream: Stream) {
    if (this.localStream != stream) throw new Error("this is not your stream");
    this.localStream = undefined;

    Object.values(this.peerConnections).forEach((pc) => {
      this.removeStreamToPeer(pc);
    });

    console.log("[RTC] Unpublish stream");
  }

  /**
   *
   * @param stream Stream have stream.params, use to set constraint on the peer
   */
  setConstraint(stream: Stream) {
    if (this.localStream != stream) throw new Error("this is not your stream");

    Object.values(this.peerConnections).forEach((pc) => {
      if (!stream.params.audio) {
        // si false on desactive
        this.disableTrackToPeer(pc, stream.mediastream.getAudioTracks()[0]);
      } else {
        // si true on reactive
        this.enableTrackToPeer(pc, stream.mediastream.getAudioTracks()[0]);
      }
      if (!stream.params.video) {
        this.disableTrackToPeer(pc, stream.mediastream.getVideoTracks()[0]);
      } else {
        this.enableTrackToPeer(pc, stream.mediastream.getVideoTracks()[0]);
      }
    });

    console.log("[RTC] Set constraint");
  }

  private attachStreamToPeer(pc: RTCPeerConnection) {
    if (!this.localStream) return;

    this.localStream.mediastream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, this.localStream!.mediastream);
      this.senders.push(sender);
    });
  }

  private removeStreamToPeer(pc: RTCPeerConnection) {
    if (!this.localStream) return;

    this.senders.forEach((sender) => {
      pc.removeTrack(sender);
    });
  }

  private disableTrackToPeer(pc: RTCPeerConnection, track: MediaStreamTrack) {
    if (!this.localStream) return;

    this.senders.forEach((sender) => {
      if (sender.track == track) {
        const transceivers = pc.getTransceivers();
        const videoTrack = transceivers[1];
        videoTrack.direction = "recvonly";
      }
    });
  }

  private enableTrackToPeer(pc: RTCPeerConnection, track: MediaStreamTrack) {
    if (!this.localStream) return;

    this.senders.forEach((sender) => {
      if (sender.track == track) {
        const transceivers = pc.getTransceivers();
        const videoTrack = transceivers[1];
        videoTrack.direction = "sendrecv";
      }
    });
  }

  register(confId: number) {
    /*if (!this.publishStream) {
      throw new Error("Call publish() before register()");
    }*/

    this._confId = confId;
    const sender = getCurrentSession()?.contact!;
    this.sendMessage({
      from: sender.toString(),
      payload: { action: "join" },
    });

    console.log(`[CONF] Join request sent for room ${confId}`);
  }

  unregister() {
    Object.values(this.peerConnections).forEach((pc) => pc.close());
    this.peerConnections = {};

    this._confId = undefined;
    this.socket.disconnect();

    console.log("[CONF] Unregistered and socket closed");
  }

  private setupSocketListeners() {
    this.socket.on("message", async (message: SocketMessage) => {
      if (!this._confId) return;

      const { from, payload } = message;

      switch (payload.action) {
        case "join":
          console.log(`[RTC] Join received from ${from}`);
          await this.createPeerConnection(from, true);
          break;

        case "offer":
          console.log(`[RTC] Offer received from ${from}`);
          await this.handleOffer(from, payload.sdp!);
          break;

        case "answer":
          console.log(`[RTC] Answer received from ${from}`);
          await this.handleAnswer(from, payload.sdp!);
          break;

        case "ice":
          console.log(`[RTC] ICE received from ${from}`);
          await this.handleIce(from, payload.candidate!);
          break;

        case "close":
          console.log(`[RTC] Peer ${payload.disconnect} disconnected`);
          this.removePeer(payload.disconnect!);
          this.dispatchEvent(
            new CustomEvent("peopleLeave", {
              detail: { leaveId: payload.disconnect },
            })
          );
          console.log("[Socket] leave" + payload.disconnect);

          break;
      }
    });
  }

  private async createPeerConnection(from: ContactInfo, initiator: boolean) {
    const remoteUserId = from.id;
    const remoteUserName = from.name;
    if (this.peerConnections[remoteUserId]) return; //existe deja

    const pc = new RTCPeerConnection();
    this.peerConnections[remoteUserId] = pc;

    if (this.localStream) {
      this.attachStreamToPeer(pc);
    }

    const sender = getCurrentSession()?.contact!;

    pc.ontrack = (event) => {
      console.log("[RTC] Track received");
      this.dispatchEvent(
        new CustomEvent("stream", {
          detail: {
            stream: new Stream(event.streams[0], remoteUserId, remoteUserName),
          },
        })
      );
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          from: sender.toString(),
          target: remoteUserId,
          payload: { action: "ice", candidate: event.candidate },
        });
      }
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendMessage({
        from: sender.toString(),
        target: remoteUserId,
        payload: {
          action: "offer",
          sdp: offer,
        },
      });
    }
  }

  private async handleOffer(from: ContactInfo, sdp: RTCSessionDescriptionInit) {
    const remoteUserId = from.id;
    await this.createPeerConnection(from, false);

    const pc = this.peerConnections[remoteUserId];
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    let sender = getCurrentSession()?.contact!;

    this.sendMessage({
      from: sender.toString(),
      target: remoteUserId,
      payload: {
        action: "answer",
        sdp: answer,
      },
    });

    const event: CustomEvent = new CustomEvent("newPeople", {
      detail: {
        contact: from,
      },
    });
    this.dispatchEvent(event);
  }

  private async handleAnswer(
    from: ContactInfo,
    sdp: RTCSessionDescriptionInit
  ) {
    const remoteUserId = from.id;
    const pc = this.peerConnections[remoteUserId];
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const event: CustomEvent = new CustomEvent("newPeople", {
      detail: {
        contact: from,
      },
    });
    this.dispatchEvent(event);
  }

  private async handleIce(from: ContactInfo, candidate: RTCIceCandidate) {
    const remoteUserId = from.id;
    const pc = this.peerConnections[remoteUserId];
    if (!pc) return;

    await pc.addIceCandidate(candidate);
  }

  private removePeer(remoteId: string) {
    this.peerConnections[remoteId]?.close();
    delete this.peerConnections[remoteId];
  }

  private sendMessage(msg: SocketMessage) {
    this.socket.emit("message", msg);
  }
}
