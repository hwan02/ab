/**
 * Pick a localized field from an object.
 * e.g. lp(property, "name", "en") → property.name_en || property.name
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lp(obj: any, field: string, locale: string): string {
  if (locale === "ko") return (obj[field] as string) ?? "";
  const localized = obj[`${field}_${locale}`] as string | null | undefined;
  return localized || (obj[field] as string) || "";
}

/**
 * Check if a DB translation exists for the given field + locale.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasDbTranslation(obj: any, field: string, locale: string): boolean {
  if (locale === "ko") return true;
  return !!obj[`${field}_${locale}`];
}
