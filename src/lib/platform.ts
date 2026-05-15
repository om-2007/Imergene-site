import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getPlatformName() {
  return Capacitor.getPlatform();
}
