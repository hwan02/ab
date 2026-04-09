import { z } from "zod";
import type { NearbyPlace } from "@/types/database";

export const propertyFormSchema = z.object({
  name: z.string().trim().min(1, "propertyForm.nameRequired"),
  description: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  wifi_ssid: z.string().trim().optional().default(""),
  wifi_password: z.string().trim().optional().default(""),
  checkin_guide: z.string().trim().optional().default(""),
  checkout_guide: z.string().trim().optional().default(""),
  house_rules: z.string().trim().optional().default(""),
});

export type PropertyFormData = z.infer<typeof propertyFormSchema>;

export const itemRequestSchema = z.object({
  itemName: z.string().trim().min(1, "itemForm.itemNameRequired"),
  quantity: z.string().min(1),
  urgency: z.string(),
  notes: z.string().trim().optional().default(""),
});

export type ItemRequestData = z.infer<typeof itemRequestSchema>;

export const reservationRequestSchema = z.object({
  restaurantName: z.string().trim().min(1, "reservationForm.restaurantRequired"),
  date: z.string().min(1, "reservationForm.dateRequired"),
  time: z.string().min(1, "reservationForm.timeRequired"),
  partySize: z.string().min(1),
  specialRequests: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  mapUrl: z.string().trim().optional().default(""),
  googlePlaceId: z.string().trim().optional().default(""),
});

export type ReservationRequestData = z.infer<typeof reservationRequestSchema>;

const nearbyPlaceCategories = [
  "attraction",
  "restaurant",
  "convenience",
  "experience",
] as const satisfies readonly NearbyPlace["category"][];

export const nearbyPlaceFormSchema = z.object({
  name: z.string().trim().min(1, "nearbyForm.nameRequired"),
  description: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  category: z.enum(nearbyPlaceCategories),
  phone: z.string().trim().optional().default(""),
  map_url: z.string().trim().optional().default(""),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  google_place_id: z.string().trim().optional().default(""),
});

export type NearbyPlaceFormData = z.infer<typeof nearbyPlaceFormSchema>;

export function getFieldErrors(
  error: z.ZodError
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field && !errors[String(field)]) {
      errors[String(field)] = issue.message;
    }
  }
  return errors;
}
