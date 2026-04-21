import { Stream } from "./Stream";
import { getCurrentSession } from "./utils";

export class DeviceManager {
  private static _instance: DeviceManager;

  currentAudioInput?: string;
  currentVideoInput?: string;
  currentAudioOutput?: string;

  private constructor() {
    this.setListeners();
  }

  public static createInstance(): DeviceManager {
    if (!DeviceManager._instance) {
      DeviceManager._instance = new DeviceManager();
    }

    return DeviceManager._instance;
  }

  async getAvailableDevices(
    kind: "videoinput" | "audioinput",
  ): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === kind);
  }

  getCurrentDevices() {
    return {
      audioInput: this.currentAudioInput,
      videoInput: this.currentVideoInput,
      audioOutput: this.currentAudioOutput,
    };
  }

  async changeAudioDevice(newAudioDevice: MediaDeviceInfo) {
    let newStream = await Stream.getCamera(
      true,
      true,
      newAudioDevice.deviceId,
      undefined,
    );
    this.changePublishedCameraStream(newStream);
    return newStream;
  }

  async changeVideoDevice(newVideoDevice: MediaDeviceInfo) {
    let newStream = await Stream.getCamera(
      true,
      true,
      undefined,
      newVideoDevice.deviceId,
    );
    this.changePublishedCameraStream(newStream);
    return newStream;
  }

  /**
   * Replace the current CAMERA stream to the specified stream
   *
   * @param newStream New stream to replace
   */
  private changePublishedCameraStream(newStream: Stream) {
    const session = getCurrentSession();
    session?.socketInteraction.replaceCameraStream(newStream);
  }

  private setListeners() {
    navigator.mediaDevices.addEventListener("devicechange", (event) => {
      console.log("New device detected : ", event);
    });
  }
}
