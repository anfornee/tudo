import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Helper function to decode base64url strings natively
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return atob(base64);
}

// Helper to convert an x509 PEM certificate string into a native CryptoKey object
async function importCertToKey(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN CERTIFICATE-----";
  const pemFooter = "-----END CERTIFICATE-----";
  const pemContents = pem
    .substring(pem.indexOf(pemHeader) + pemHeader.length, pem.indexOf(pemFooter))
    .replace(/\s/g, "");

  // Convert base64 string to an ArrayBuffer
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    // 1. Split the JWT into [Header, Payload, Signature]
    const parts = idToken.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT layout");
    const [headerStr, payloadStr, signatureStr] = parts;

    // 2. Parse the Header to find the Key ID ("kid")
    const header = JSON.parse(base64UrlDecode(headerStr));
    const kid = header.kid;

    // 3. Fetch Google's public x509 certificates
    const certsResponse = await fetch("https://googleapis.com");
    const publicCerts = await certsResponse.json();
    const targetCert = publicCerts[kid];
    if (!targetCert) throw new Error("Matching public key not found");

    // 4. Verify the Token Signature using native Web Crypto APIs
    const publicKey = await importCertToKey(targetCert);
    
    // Combine header and payload into an ArrayBuffer for signature validation
    const enc = new TextEncoder();
    const dataToVerify = enc.encode(`${headerStr}.${payloadStr}`);
    
    // Decode the signature into an ArrayBuffer
    const sigBinary = base64UrlDecode(signatureStr);
    const signatureBuffer = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      signatureBuffer[i] = sigBinary.charCodeAt(i);
    }

    const isSignatureValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signatureBuffer,
      dataToVerify
    );

    if (!isSignatureValid) throw new Error("Signature validation failed");

    // 5. Inspect the Payload claims (Expiration, Project Target, Audience)
    const payload = JSON.parse(base64UrlDecode(payloadStr));
    const now = Math.floor(Date.now() / 1000);
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (payload.exp < now) throw new Error("Token has expired");
    if (payload.aud !== projectId) throw new Error("Audience mismatch");
    if (payload.iss !== `https://google.com{projectId}`) throw new Error("Issuer mismatch");

    // 6. Save the token as an HTTP-Only cookie
    const cookieStore = await cookies();
    cookieStore.set("session", idToken, {
      maxAge: 60 * 60 * 24 * 5, // 5 days in seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("Native validation failed:", error.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
