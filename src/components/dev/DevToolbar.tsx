"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface PropertyLink {
  id: string;
  name: string;
}

export default function DevToolbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<PropertyLink[]>([]);

  const isHost = pathname.startsWith("/host");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("properties")
      .select("id, name")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProperties(data);
      });
  }, []);

  // Extract current property ID from URL
  const propertyIdMatch = pathname.match(/\/property\/([^/]+)/);
  const currentPropertyId = propertyIdMatch?.[1];

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {open && (
        <div className="mb-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl">
          <div className="mb-2 text-xs font-bold text-gray-400 uppercase">
            DEV — Mode Switch
          </div>

          {/* Mode toggle */}
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => router.push("/")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                !isHost
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Guest
            </button>
            <button
              onClick={() => router.push("/host")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                isHost
                  ? "bg-white text-rose-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Host
            </button>
          </div>

          {/* Property quick links */}
          {properties.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-gray-400">
                Properties
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {properties.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-lg border px-2 py-1.5 text-xs ${
                      currentPropertyId === p.id
                        ? "border-rose-200 bg-rose-50"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="mb-1 truncate font-medium text-gray-700">
                      {p.name}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => router.push(`/property/${p.id}`)}
                        className="rounded bg-blue-50 px-2 py-0.5 text-blue-600 hover:bg-blue-100"
                      >
                        Guest
                      </button>
                      <button
                        onClick={() =>
                          router.push(`/host/property/${p.id}/edit`)
                        }
                        className="rounded bg-rose-50 px-2 py-0.5 text-rose-600 hover:bg-rose-100"
                      >
                        Host
                      </button>
                      <button
                        onClick={() =>
                          router.push(
                            isHost
                              ? `/host/property/${p.id}/chat`
                              : `/property/${p.id}/chat`
                          )
                        }
                        className="rounded bg-gray-100 px-2 py-0.5 text-gray-600 hover:bg-gray-200"
                      >
                        Chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
        title="Dev Toolbar"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.193-.14 1.743" />
        </svg>
      </button>
    </div>
  );
}
