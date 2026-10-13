import { NextResponse } from "next/server";

// Keep verification URLs separate from the contact lookup endpoint while the
// verification logic remains centralized in its parent route.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const destination = new URL("/api/customer-email", url.origin);
  if (token) destination.searchParams.set("token", token);
  return NextResponse.redirect(destination);
}
