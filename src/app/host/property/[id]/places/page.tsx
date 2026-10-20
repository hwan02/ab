"use client";

import { use } from "react";
import FoodLists from "@/components/host/FoodLists";

export default function PlacesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">장소</h1>
      <FoodLists propertyId={id} />
    </div>
  );
}
