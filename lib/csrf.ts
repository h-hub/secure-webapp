import crypto from "crypto";

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function validateCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | null,
): boolean {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken),
  );
}
