import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  AGENT_IDENTITY_PROGRAM_ID,
  discoverAgents,
  getCluster,
  getServerRpcUrl,
  parsePublicKey,
  verifyAgentIdentities,
  type AgentVerification,
  type DiscoveredAgent,
} from "../../../lib/agent-registry";
import { ITINERARY_AGENT_ASSET } from "../../../lib/solana-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AgentService = { name: string; endpoint: string; type: string };

// Demo concierge personas. They describe this app's own API features and are NOT registered
// in the Metaplex Agent Registry, so they carry no mint, PDA or verification claim.
const DEMO_PERSONAS: Array<{ id: string; name: string; displayName: string; description: string; specialty: string; services: AgentService[] }> = [
  {
    id: "demo-heritage-concierge",
    name: "Touristमत्रम् Heritage Concierge",
    displayName: "Touristमत्रम् Heritage & Travel Concierge",
    description: "Demo persona for heritage itineraries and itinerary hashing. Backed by this app's planner and the itinerary commitment program.",
    specialty: "Heritage Itineraries & Itinerary Commitments",
    services: [
      { name: "Day-by-Day Itinerary Generation", endpoint: "/api/planner", type: "HTTP" },
      { name: "Itinerary Commitment (Anchor)", endpoint: "tourism_registry::commit_itinerary", type: "Solana program" },
    ],
  },
  {
    id: "demo-stays-transit",
    name: "Stays & Transit Concierge",
    displayName: "Stays & Transit Planning Concierge",
    description: "Demo persona for transit passes and budget planning using the curated city data shipped with this app.",
    specialty: "Transit Passes & Budget Planning",
    services: [{ name: "Itinerary Planner", endpoint: "/api/planner", type: "HTTP" }],
  },
  {
    id: "demo-temple-guide",
    name: "Cultural & Temple Guide",
    displayName: "Heritage Landmark & Temple Guide",
    description: "Demo persona for historical context and safety tips for heritage sites, using this app's safety and planner endpoints.",
    specialty: "Cultural History & Site Safety",
    services: [
      { name: "Safety Guidance", endpoint: "/api/safety", type: "HTTP" },
      { name: "Itinerary Planner", endpoint: "/api/planner", type: "HTTP" },
    ],
  },
  {
    id: "demo-fare-auditor",
    name: "Route & Fare Auditor",
    displayName: "Route & Transit Cost Optimizer",
    description: "Demo persona that compares quoted fares with the reference rates in this app's price checker.",
    specialty: "Fare Auditing & Scam Checks",
    services: [
      { name: "Fair Price Check", endpoint: "/api/price", type: "HTTP" },
      { name: "Scam Pattern Check", endpoint: "/api/scam", type: "HTTP" },
    ],
  },
];

const DEMO_VERIFICATION = {
  status: "simulated" as const,
  verified: false,
  reason: "Demo persona — not registered in the Metaplex Agent Registry.",
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "travel").trim().slice(0, 64);
  const cluster = getCluster();
  const errors: string[] = [];

  const demoAgents = DEMO_PERSONAS.map(p => ({
    ...p,
    kind: "simulated" as const,
    simulated: true,
    mintAddress: null,
    identityPda: null,
    verification: DEMO_VERIFICATION,
  }));

  // 1. Discovery (off-chain index) — every result is re-verified on-chain below.
  let discovered: DiscoveredAgent[] = [];
  let discoveryStatus: "ok" | "unavailable" = "ok";
  let discoveryTotal = 0;
  try {
    const result = await discoverAgents(query, { pageSize: 6 });
    discovered = result.agents;
    discoveryTotal = result.total;
  } catch (e) {
    discoveryStatus = "unavailable";
    errors.push(`Agent discovery unavailable: ${errorMessage(e)}`);
  }

  // 2. Live on-chain verification for the itinerary reference asset plus discovered assets.
  const reference = parsePublicKey(ITINERARY_AGENT_ASSET);
  if (!reference) errors.push("NEXT_PUBLIC_ITINERARY_AGENT_ASSET is not a valid public key.");
  const assets: PublicKey[] = [];
  const seen = new Set<string>();
  for (const key of [reference, ...discovered.map(d => parsePublicKey(d.mintAddress))]) {
    if (key && !seen.has(key.toBase58())) {
      seen.add(key.toBase58());
      assets.push(key);
    }
  }

  const connection = new Connection(getServerRpcUrl(), "confirmed");
  const verifications: AgentVerification[] = await verifyAgentIdentities(connection, assets, { timeoutMs: 8000 });
  if (verifications.some(v => v.status === "unavailable")) {
    errors.push("Solana RPC unavailable — registry agents could not be verified.");
  }

  const registryAgents = verifications.map(v => {
    const listing = discovered.find(d => d.mintAddress === v.asset);
    const isReference = v.asset === reference?.toBase58();
    const name = v.assetAccount?.name || listing?.name || "Unnamed registry agent";
    return {
      id: v.asset,
      kind: "registry" as const,
      simulated: false,
      name,
      displayName: name,
      description: isReference
        ? "Reference agent identity recorded in this app's itinerary commitments. It is a third-party devnet test agent, not operated by this project."
        : listing?.description || "Agent listed in the Metaplex Agent Registry index.",
      specialty: isReference ? "Itinerary commitment reference identity" : "Metaplex Agent Registry listing",
      source: isReference ? "configured" : "metaplex-api",
      services: [] as AgentService[],
      mintAddress: v.asset,
      identityPda: v.identityPda,
      verification: v,
    };
  });

  const agents = [...registryAgents, ...demoAgents];
  const count = (s: string) => agents.filter(a => a.verification.status === s).length;

  return NextResponse.json({
    data: { agents, total: agents.length },
    summary: {
      verified: count("verified"),
      unverified: count("unregistered") + count("mismatch") + count("invalid_account"),
      unavailable: count("unavailable"),
      simulated: count("simulated"),
    },
    sources: {
      discovery: { provider: "Metaplex agents API (off-chain index)", status: discoveryStatus, query, totalMatches: discoveryTotal },
      verification: { provider: "Solana RPC", programId: AGENT_IDENTITY_PROGRAM_ID.toBase58() },
    },
    cluster,
    queriedAt: new Date().toISOString(),
    errors,
  });
}
