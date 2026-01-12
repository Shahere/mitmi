import { io, Socket } from "socket.io-client";
import { serverUrl } from "../constants";
import { getCurrentSession } from "../utils";
import { Stream, StreamParams } from "../Stream";
import { ContactInfo } from "../Contact";

/**
 * Type of message between server and client
 */
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

type SendersByStream = Record<string, RTCRtpSender[]>;

/**
 * Main interaction between socket and server
 *
 * @private
 *
 */
export class SocketInteraction extends EventTarget {
  private socket!: Socket;
  private _userId?: string;
  private _confId?: number;
  private localStream?: Stream;
  private sendersByStream: SendersByStream = {};

  private peerConnections: Record<string, RTCPeerConnection> = {};
  private pendingCandidates: Record<
    string,
    Array<RTCIceCandidate | RTCIceCandidateInit>
  > = {};

  async init(): Promise<string> {
    this.socket = io(serverUrl, {});

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

  /**
   * Publish a Stream into all peers
   *
   * @param stream - Stream to publish
   */
  //TODO Check to publish multiple stream, ATM => one at the moment
  publish(stream: Stream) {
    this.localStream = stream;

    Object.values(this.peerConnections).forEach((pc) => {
      this.attachStreamToPeer(pc, stream);
    });

    console.log("[RTC] Stream published to all peers");
  }

  /**
   * Unbuplish stream into all peers
   *
   * @param stream - Stream to unpublish
   */
  unpublish(stream: Stream) {
    if (this.localStream != stream) throw new Error("this is not your stream");
    this.localStream = undefined;

    Object.values(this.peerConnections).forEach((pc) => {
      this.removeStreamToPeer(pc, stream);
    });

    console.log("[RTC] Unpublish stream");
  }

  /**
   * Attach a stream to a peer
   *
   * @param pc - PeerConnection to attach this.localstream
   * @returns
   */
  //TODO don't use this.localstream, but a parameter instead ?
  private attachStreamToPeer(pc: RTCPeerConnection, localstream: Stream) {
    localstream.mediastream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, localstream.mediastream);
      if (!this.sendersByStream[localstream.id]) {
        this.sendersByStream[localstream.id] = [];
      }
      this.sendersByStream[localstream.id].push(sender);
    });
  }

  /**
   * Detach a stream to a peer
   *
   * @param pc - PeerConnection to detach this.localstream
   * @returns
   */
  //TODO don't use this.localstream, but a parameter instead ?
  private removeStreamToPeer(pc: RTCPeerConnection, localstream: Stream) {
    if (!this.localStream) return;

    let senders = this.sendersByStream[localstream.id];
    senders.forEach((sender) => {
      pc.removeTrack(sender);
    });
  }

  /**
   * Send a join message to the server
   *
   * @param confId - ID conference
   */
  register(confId: number) {
    this._confId = confId;
    const sender = getCurrentSession()?.contact!;
    this.sendMessage({
      from: sender.toString(),
      payload: { action: "join" },
    });

    console.log(`[CONF] Join request sent for room ${confId}`);
  }

  /**
   * Disconnect
   */
  unregister() {
    //Stop all the track before (release camera and microphone)
    if (this.localStream) {
      this.localStream.mediastream.getTracks().forEach((track) => track.stop());
    }

    const sender = getCurrentSession()?.contact!;
    this.sendMessage({
      from: sender.toString(),
      payload: {
        action: "close",
        disconnect: sender.toString().id,
      },
    });

    Object.values(this.peerConnections).forEach((pc) => pc.close());
    this.peerConnections = {};

    this._confId = undefined;
    this.socket.disconnect();

    console.log("[CONF] Unregistered and socket closed");
  }

  /**
   * Set Listeners
   *
   * @private
   */
  private setupSocketListeners() {
    this.socket.on("message", async (message: SocketMessage) => {
      if (!this._confId) return;

      const { from, payload } = message;

      switch (payload.action) {
        case "join":
          console.log(`[RTC] Join received from ${from.name}`);
          await this.createPeerConnection(from, true);
          break;

        case "offer":
          console.log(`[RTC] Offer received from ${from.name}`);
          await this.handleOffer(from, payload.sdp!);
          break;

        case "answer":
          console.log(`[RTC] Answer received from ${from.name}`);
          await this.handleAnswer(from, payload.sdp!);
          break;

        case "ice":
          console.log(`[RTC] ICE received from ${from.name}`);
          await this.handleIce(from, payload.candidate!);
          break;

        case "close":
          if (from) {
            //Normal way
            console.log(`[RTC] Peer ${from.name} disconnected`);
            this.removePeer(payload.disconnect!);
            this.dispatchEvent(
              new CustomEvent("peopleLeave", {
                detail: { leaveId: payload.disconnect, name: from.name },
              })
            );
          } else {
            //Message send by server
            //Normal way
            console.log(`[RTC] Someone disconnected`);
            this.removePeer(payload.disconnect!);
            this.dispatchEvent(
              new CustomEvent("peopleLeave", {
                detail: {
                  leaveId: payload.disconnect,
                  name: "Call conference.leave()",
                },
              })
            );
          }
          break;
      }
    });
  }

  /**
   * Create a Peerconnection with the remote contact
   *
   * @param from - Peerconnection with this contact
   * @param initiator - Are you the applicant ? IF yes send an Offer
   * @returns
   */
  private async createPeerConnection(
    from: ContactInfo,
    initiator: boolean
  ): Promise<RTCPeerConnection> {
    const remoteUserId = from.id;
    const remoteUserName = from.name;
    if (this.peerConnections[remoteUserId]) {
      return this.peerConnections[remoteUserId]; // Already exist
    }

    const pc = new RTCPeerConnection();
    this.peerConnections[remoteUserId] = pc;

    if (this.localStream) {
      this.attachStreamToPeer(pc, this.localStream);
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

    return pc;
  }

  /**
   * Event handle the offer
   *
   * @param from - Contact who send the offer
   * @param sdp - Offer
   */
  private async handleOffer(from: ContactInfo, sdp: RTCSessionDescriptionInit) {
    const remoteUserId = from.id;
    const pc = await this.createPeerConnection(from, false);

    //const pc = this.peerConnections[remoteUserId];

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
      console.error("Remote decription error : ", error);
    }

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

    // flush pending ICE candidates received before remoteDescription was set
    await this.flushPendingCandidates(remoteUserId);

    const event: CustomEvent = new CustomEvent("newPeople", {
      detail: {
        contact: from,
      },
    });
    this.dispatchEvent(event);
  }

  /**
   * Event handle the enswer
   *
   * @param from - Contact who send tjhe answer
   * @param sdp - The answer
   * @returns
   */
  private async handleAnswer(
    from: ContactInfo,
    sdp: RTCSessionDescriptionInit
  ) {
    const remoteUserId = from.id;
    const pc = this.peerConnections[remoteUserId];
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // flush pending ICE candidates received before remoteDescription was set
    await this.flushPendingCandidates(remoteUserId);

    const event: CustomEvent = new CustomEvent("newPeople", {
      detail: {
        contact: from,
      },
    });
    this.dispatchEvent(event);
  }

  /**
   * Event when receive ice candidates
   *
   * @param from - Contact
   * @param candidate - Icecandidate
   * @returns
   */
  private async handleIce(from: ContactInfo, candidate: RTCIceCandidate) {
    const remoteUserId = from.id;
    /*if (!pc) return;

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error("Ice error : ", error);
      console.error(pc);
    }*/
    const pc = this.peerConnections[remoteUserId];
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      this.pendingCandidates[remoteUserId] =
        this.pendingCandidates[remoteUserId] || [];
      this.pendingCandidates[remoteUserId].push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error("Ice error : ", error);
    }
  }

  private async flushPendingCandidates(remoteUserId: string): Promise<void> {
    const pc = this.peerConnections[remoteUserId];
    if (!pc) return; // No remote description attach to this user

    const pendingCandidates = this.pendingCandidates[remoteUserId];
    if (!pendingCandidates || !pendingCandidates.length) return; // No pending candidates

    for (const pendingCandidate of pendingCandidates) {
      try {
        await pc.addIceCandidate(pendingCandidate);
      } catch (e) {
        console.error("Error adding pending ICE candidate", e);
      }
    }
    delete this.pendingCandidates[remoteUserId];
  }

  /**
   * Event when receive a disconnection message
   *
   * @param remoteId - ID that leave
   */
  private removePeer(remoteId: string) {
    this.peerConnections[remoteId]?.close();
    delete this.peerConnections[remoteId];
  }

  /**
   * Send a message on the socket
   *
   * @param msg - Message to send on the socket
   */
  private sendMessage(msg: SocketMessage) {
    this.socket.emit("message", msg);
  }
}
