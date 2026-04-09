"use client";

import { type ReactNode } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export default function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  if (!API_KEY) {
    return <>{children}</>;
  }

  return (
    <APIProvider apiKey={API_KEY} libraries={["places"]}>
      {children}
    </APIProvider>
  );
}

export function hasGoogleMapsKey(): boolean {
  return !!API_KEY;
}
