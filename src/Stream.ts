import { Conference } from "./Conference";
import { setLocalStream } from "./utils";

export interface StreamParams {
  audio: boolean;
  video: boolean;
}

class Stream {
  mediastream: MediaStream;
  domElement: undefined | HTMLVideoElement;
  ownerId: string;
  ownerName: string;
  id: String;
  //If undefined, its a localstream otherwise the stream is publish
  conferencePublish?: Conference;
  params: StreamParams;

  /**
   *
   * @param mediastream
   * @param owner "" => ourself, id instead
   */
  constructor(mediastream: MediaStream, ownerId: string, ownerName: string) {
    this.mediastream = mediastream;
    this.ownerId = ownerId;
    this.ownerName = ownerName;
    this.id = ownerId + "_usermedia";
    this.params = { audio: true, video: false };
  }

  isLocal(): boolean {
    return this.ownerId === "";
  }

  /**
   * Will update lastest camera stream known (for DeviceMananger)
   * @param video
   * @param audio
   * @returns
   */
  static async getCamera(
    video: boolean,
    audio: boolean,
    audioDeviceId?: string,
    videoDeviceId?: string
  ): Promise<Stream> {
    let constraints: any;
    let mediastream: MediaStream;
    try {
      constraints = {
        video: videoDeviceId ? { deviceId: { ideal: videoDeviceId } } : video,
        audio: audioDeviceId ? { deviceId: { ideal: audioDeviceId } } : audio,
      };

      mediastream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      const message = "Camera non disponible, veuillez essayer une autre";
      alert(message);
      throw message;
    }
    let newStream = new Stream(mediastream, "", "");
    setLocalStream(newStream);
    return newStream;
  }
  static getScreen() {}

  attachToElement(domElement: HTMLVideoElement): void {
    this.domElement = domElement;
    domElement.srcObject = this.mediastream;

    if (this.isLocal()) {
      this.disableAudio();
    }
  }

  detachToElement(): void {
    if (!this.domElement) return;
    this.domElement.srcObject = null;
  }

  /**
   * If the stream is published (so its yours) :
   *  - video will be disabled for everyone
   * If the stream is not published (its yours but not publish, or other ppl stream):
   *  - video will be disabled for you only
   */
  muteVideo() {
    this.params.video = false;
    if (this.conferencePublish) {
      //your publish stream
      this.conferencePublish.session.socketInteraction.setConstraint(this);
    }
    this.mediastream.getVideoTracks()[0].enabled = false;
  }

  unmuteVideo() {
    this.params.video = true;
    if (this.conferencePublish) {
      //your publish stream
      this.conferencePublish.session.socketInteraction.setConstraint(this);
    }
    this.mediastream.getVideoTracks()[0].enabled = true;
  }

  muteAudio(): void {
    this.params.audio = false;
    if (this.conferencePublish) {
      this.conferencePublish.session.socketInteraction.setConstraint(this);
    }
    this.mediastream.getAudioTracks()[0].enabled = false;
  }

  unmuteAudio(): void {
    this.params.audio = true;
    if (this.conferencePublish) {
      this.conferencePublish.session.socketInteraction.setConstraint(this);
    }
    this.mediastream.getAudioTracks()[0].enabled = true;
  }

  /**
   * This function exist to avoir Larsen.
   * You need to call here when a localstream is started.
   */
  disableAudio(): void {
    if (!this.domElement) return;

    // Important: cette ligne n'affecte pas l'envoi audio
    this.domElement.muted = true;
    this.domElement.volume = 0;

    console.warn(this.ownerId, this.domElement.volume, this.domElement.muted);
  }

  /**
   * TODO do better
   */
  enableAudio(): void {
    if (!this.domElement) return;

    // Important: cette ligne n'affecte pas l'envoi audio
    this.domElement.muted = false;
    this.domElement.volume = 1;

    console.warn(this.ownerId, this.domElement.volume, this.domElement.muted);
  }
}

export { Stream };
