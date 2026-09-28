import { requireOptionalNativeModule } from "expo-modules-core";

interface DisplayZoomModule {
  readonly zooms: number[];
  readonly defaultZoom: number;
  getZoom(): number;
  setZoom(zoom: number): void;
}

/** Android only. Null on iOS and in tests, where the app keeps the system size. */
export const DisplayZoom = requireOptionalNativeModule<DisplayZoomModule>("DisplayZoom");
