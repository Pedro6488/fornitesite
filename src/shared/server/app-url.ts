export const DEFAULT_APP_URL = "https://fornitesite.vercel.app";

export function getAppUrl(value = process.env.NEXT_PUBLIC_APP_URL): string {
  return (value?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
}
