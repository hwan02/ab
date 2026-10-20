"use client";

import { use } from "react";
import PlaceBoard from "@/components/host/PlaceBoard";

export default function PlacesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">장소</h1>
      <PlaceBoard propertyId={id} />
    </div>
  );
}
