export const DEFAULT_APP_URL = "https://www.sigfriedlootbox.com";

export function getAppUrl(value = process.env.NEXT_PUBLIC_APP_URL): string {
  return (value?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
}
