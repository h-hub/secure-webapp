import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = cookies();
  const token = (await cookieStore).get("token")?.value;
  return token;
}

async function getRefreshToken() {
  const cookieStore = cookies();
  const token = (await cookieStore).get("refreshToken")?.value;
  return token;
}

export { getAuthToken, getRefreshToken };
