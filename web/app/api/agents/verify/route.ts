import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { getServerRpcUrl, parsePublicKey, verifyAgentIdentity } from "../../../../lib/agent-registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/agents/verify?asset=<MPL Core asset>[&identityPda=<expected PDA>]
 * 200: verified | unregistered | mismatch | invalid_account   400: bad input   503: RPC unavailable
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetParam = searchParams.get("asset")?.trim();
  const expectedPda = searchParams.get("identityPda")?.trim() || null;

  if (!assetParam) {
    return NextResponse.json({ status: "invalid_input", verified: false, error: "asset parameter required" }, { status: 400 });
  }
  const asset = parsePublicKey(assetParam);
  if (!asset) {
    return NextResponse.json({ status: "invalid_input", verified: false, error: "asset is not a valid base58 public key" }, { status: 400 });
  }
  if (expectedPda && !parsePublicKey(expectedPda)) {
    return NextResponse.json({ status: "invalid_input", verified: false, error: "identityPda is not a valid base58 public key" }, { status: 400 });
  }

  const connection = new Connection(getServerRpcUrl(), "confirmed");
  const result = await verifyAgentIdentity(connection, asset, { timeoutMs: 8000, expectedPda });

  return NextResponse.json(
    { ...result, registered: result.verified },
    { status: result.status === "unavailable" ? 503 : 200 }
  );
}
