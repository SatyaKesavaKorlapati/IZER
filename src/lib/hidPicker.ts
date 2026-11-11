export type ScannedHidDevice = {
  deviceId: string;
  vendorId?: number;
  productId?: number;
  productName?: string;
};

const HID_LIST_EVENT = "izer-hid-device-list";

export function subscribeHidDeviceList(onList: (devices: ScannedHidDevice[]) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ScannedHidDevice[]>).detail;
    if (Array.isArray(detail)) onList(detail);
  };
  window.addEventListener(HID_LIST_EVENT, handler as EventListener);
  return () => window.removeEventListener(HID_LIST_EVENT, handler as EventListener);
}

export { electronDefersHidPicker } from "./hid";
