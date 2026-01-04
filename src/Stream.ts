import { Conference } from "./Conference";
import { setLocalStream } from "./utils";

/**
 * Stream constraints
 */
export interface StreamParams {
  audio: boolean;
  video: boolean;
}

/**
 * This class represent a video, camera or screenshare.
 */
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
   * Create a Stream
   *
   * @param mediastream - The video input to attach to the stream
   * @param ownerId - The ownerId of the mediastream
   * @param ownerName - The owner of the mediastream
   *
   */
  //TODO Enlever le fait que ownerid est une string vide si l'owner est soit meme
  constructor(mediastream: MediaStream, ownerId: string, ownerName: string) {
    this.mediastream = mediastream;
    this.ownerId = ownerId;
    this.ownerName = ownerName;
    this.id = ownerId + "_usermedia";
    this.params = { audio: true, video: false };
  }

  /**
   * Check if the stream is local
   *
   * @returns - True if it's a localstream, false instead
   */
  isLocal(): boolean {
    return this.ownerId === "";
  }

  /**
   * Get camera input
   *
   * @param video - Is video enable ?
   * @param audio - Is audio enable ?
   * @param audioDeviceId optional - Use a specific audio device
   * @param videoDeviceId optional - Use a specific video device
   *
   * @returns A stream with your camera.
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

  /**
   * Attach the stream to your DOM
   *
   * @param domElement - The HTML element to attach the stream
   */
  attachToElement(domElement: HTMLVideoElement): void {
    this.domElement = domElement;
    domElement.srcObject = this.mediastream;

    if (this.isLocal()) {
      this.localMuteAudio();
    }
  }

  /**
   * Detach the stream to your DOM
   */
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
  //TODO do better with mute, ex: all in one method ?
  globalMuteVideo() {
    if (this.conferencePublish) {
      this.params.video = false;
      //this.conferencePublish.session.socketInteraction.setConstraint(this);
      this.mediastream.getVideoTracks()[0].enabled = false;
    }
  }

  globalUnmuteVideo() {
    if (this.conferencePublish) {
      this.params.video = true;
      //this.conferencePublish.session.socketInteraction.setConstraint(this);
      this.mediastream.getVideoTracks()[0].enabled = true;
    }
  }

  globalMuteAudio(): void {
    if (this.conferencePublish) {
      this.params.audio = false;
      //this.conferencePublish.session.socketInteraction.setConstraint(this);
      this.mediastream.getAudioTracks()[0].enabled = false;
    }
  }

  globalUnmuteAudio(): void {
    if (this.conferencePublish) {
      this.params.audio = true;
      //this.conferencePublish.session.socketInteraction.setConstraint(this);
      this.mediastream.getAudioTracks()[0].enabled = true;
    }
  }

  /**
   * Disable local audio
   */
  localMuteAudio(): void {
    if (!this.domElement) return;

    this.domElement.muted = true;
    this.domElement.volume = 0;
  }

  /**
   * Enable local audio
   */
  localUnmuteAudio(): void {
    if (!this.domElement) return;

    this.domElement.muted = false;
    this.domElement.volume = 1;
  }

  /**
   * Disable local video
   */
  localMuteVideo(): void {
    if (!this.domElement) return;

    this.domElement.pause();
  }

  /**
   * Enable local video
   */
  async localUnmuteVideo(): Promise<void> {
    if (!this.domElement) return;

    await this.domElement.play();
  }
}

export { Stream };
