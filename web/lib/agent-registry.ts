import { Connection, PublicKey } from "@solana/web3.js";

// ─── Metaplex Agent Registry (verified against @metaplex-foundation/mpl-agent-registry 0.2.6) ───
// Identity program is deployed at the same address on mainnet and devnet.
export const AGENT_IDENTITY_PROGRAM_ID = new PublicKey("1DREGFgysWYxLnRnKQnwrxnJQeSMk2HmGaC6whw2B2p");
export const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
export const METAPLEX_AGENTS_API = "https://api.metaplex.com/v1/agents";

// Account `key` discriminator values from the SDK's generated Key enum.
const KEY_AGENT_IDENTITY_V1 = 1;
const KEY_AGENT_IDENTITY_V2 = 2;
// Layouts: key u8 | bump u8 | padding [u8;6] | asset Pubkey (V1 = 40 bytes)
//          ... | agentToken Option<Pubkey> (zeroed = None) | reserved [u8;32] (V2 = 104 bytes)
const IDENTITY_V1_SIZE = 40;
const IDENTITY_V2_SIZE = 104;
const ASSET_OFFSET = 8;

export type SolanaCluster = "devnet" | "mainnet-beta" | "testnet";

export function getCluster(): SolanaCluster {
  const c = process.env.SOLANA_CLUSTER || process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
  return c === "mainnet-beta" || c === "testnet" ? c : "devnet";
}

export function getServerRpcUrl(): string {
  return process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
}

/** Metaplex REST API network name for the configured cluster. */
export function metaplexNetwork(cluster: SolanaCluster = getCluster()): string {
  return cluster === "mainnet-beta" ? "solana-mainnet" : "solana-devnet";
}

export function parsePublicKey(value: string | null | undefined): PublicKey | null {
  if (!value || value.length < 32 || value.length > 44) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

export function findAgentIdentityPda(asset: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("agent_identity"), asset.toBytes()],
    AGENT_IDENTITY_PROGRAM_ID
  );
}

export type ParsedIdentity = {
  version: 1 | 2;
  bump: number;
  asset: string;
  agentToken: string | null;
};

/** Decodes an AgentIdentityV1/V2 account. Returns null for any other layout. */
export function parseAgentIdentityAccount(data: Uint8Array): ParsedIdentity | null {
  const key = data[0];
  if (key === KEY_AGENT_IDENTITY_V1 && data.length >= IDENTITY_V1_SIZE) {
    return {
      version: 1,
      bump: data[1],
      asset: new PublicKey(data.subarray(ASSET_OFFSET, ASSET_OFFSET + 32)).toBase58(),
      agentToken: null,
    };
  }
  if (key === KEY_AGENT_IDENTITY_V2 && data.length >= IDENTITY_V2_SIZE) {
    const token = data.subarray(40, 72);
    return {
      version: 2,
      bump: data[1],
      asset: new PublicKey(data.subarray(ASSET_OFFSET, ASSET_OFFSET + 32)).toBase58(),
      agentToken: token.every(b => b === 0) ? null : new PublicKey(token).toBase58(),
    };
  }
  return null;
}

/** Reads name/uri from an MPL Core AssetV1 account (key | owner | update authority | name | uri). */
export function parseCoreAssetMetadata(data: Uint8Array): { name: string; uri: string } | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let o = 1 + 32;
    const uaType = data[o];
    o += 1 + (uaType === 0 ? 0 : 32);
    const nameLen = view.getUint32(o, true);
    o += 4;
    if (nameLen > 200 || o + nameLen > data.length) return null;
    const name = new TextDecoder().decode(data.subarray(o, o + nameLen));
    o += nameLen;
    const uriLen = view.getUint32(o, true);
    o += 4;
    if (uriLen > 500 || o + uriLen > data.length) return null;
    const uri = new TextDecoder().decode(data.subarray(o, o + uriLen));
    return { name, uri };
  } catch {
    return null;
  }
}

export class RpcTimeoutError extends Error {}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RpcTimeoutError(`${label} timed out after ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type VerificationStatus =
  | "verified"        // identity PDA exists, owned by the registry, valid layout, bound to this asset
  | "unregistered"    // no identity PDA for this asset
  | "mismatch"        // PDA exists but is bound to a different asset, or caller-supplied PDA differs
  | "invalid_account" // account at the PDA has the wrong owner or an unrecognised layout
  | "unavailable";    // RPC failure or timeout — nothing can be concluded

export type VerificationCheck = { check: string; status: "PASS" | "FAIL" | "SKIP"; detail: string };

export type AgentVerification = {
  asset: string;
  status: VerificationStatus;
  verified: boolean;
  reason: string;
  identityPda: string;
  bump: number;
  identity: ParsedIdentity | null;
  identityAccount: { owner: string; dataLength: number } | null;
  assetAccount: { exists: boolean; owner: string | null; isCoreAsset: boolean; name: string | null; uri: string | null } | null;
  checks: VerificationCheck[];
  programId: string;
  cluster: SolanaCluster;
  checkedAt: string;
};

type AccountLike = { owner: PublicKey; data: Uint8Array } | null;

/** Pure evaluation of already-fetched accounts, shared by single and batch verification. */
export function evaluateIdentity(
  asset: PublicKey,
  identityAcc: AccountLike,
  assetAcc: AccountLike,
  expectedPda?: string | null
): AgentVerification {
  const [pda, bump] = findAgentIdentityPda(asset);
  const checks: VerificationCheck[] = [];
  const base = {
    asset: asset.toBase58(),
    identityPda: pda.toBase58(),
    bump,
    programId: AGENT_IDENTITY_PROGRAM_ID.toBase58(),
    cluster: getCluster(),
    checkedAt: new Date().toISOString(),
  };

  const isCore = !!assetAcc && assetAcc.owner.equals(MPL_CORE_PROGRAM_ID);
  const meta = assetAcc && isCore ? parseCoreAssetMetadata(assetAcc.data) : null;
  const assetAccount = {
    exists: !!assetAcc,
    owner: assetAcc ? assetAcc.owner.toBase58() : null,
    isCoreAsset: isCore,
    name: meta?.name ?? null,
    uri: meta?.uri || null,
  };
  checks.push({
    check: "Asset is an MPL Core asset",
    status: isCore ? "PASS" : "FAIL",
    detail: assetAcc ? `Owner ${assetAcc.owner.toBase58()}` : "Asset account not found on this cluster",
  });

  const result = (status: VerificationStatus, reason: string, extra: Partial<AgentVerification> = {}): AgentVerification => ({
    ...base,
    status,
    verified: status === "verified",
    reason,
    identity: null,
    identityAccount: identityAcc ? { owner: identityAcc.owner.toBase58(), dataLength: identityAcc.data.length } : null,
    assetAccount,
    checks,
    ...extra,
  });

  if (expectedPda && expectedPda !== base.identityPda) {
    checks.push({ check: "Supplied identity PDA matches derivation", status: "FAIL", detail: `Derived ${base.identityPda}` });
    return result("mismatch", "The supplied identity PDA does not match the PDA derived from this asset.");
  }

  if (!identityAcc) {
    checks.push({ check: "Identity PDA exists", status: "FAIL", detail: `No account at ${base.identityPda}` });
    return result(
      "unregistered",
      assetAcc
        ? "The asset exists, but no Metaplex Agent Identity has been registered for it."
        : "Neither the asset nor an agent identity exists on this cluster."
    );
  }
  checks.push({ check: "Identity PDA exists", status: "PASS", detail: `${identityAcc.data.length} bytes` });

  if (!identityAcc.owner.equals(AGENT_IDENTITY_PROGRAM_ID)) {
    checks.push({ check: "Owned by Agent Identity program", status: "FAIL", detail: `Owner ${identityAcc.owner.toBase58()}` });
    return result("invalid_account", "The account at the identity PDA is not owned by the Metaplex Agent Identity program.");
  }
  checks.push({ check: "Owned by Agent Identity program", status: "PASS", detail: AGENT_IDENTITY_PROGRAM_ID.toBase58() });

  const identity = parseAgentIdentityAccount(identityAcc.data);
  if (!identity) {
    checks.push({ check: "Recognised AgentIdentity layout", status: "FAIL", detail: `key=${identityAcc.data[0]}, ${identityAcc.data.length} bytes` });
    return result("invalid_account", "The identity account has an unrecognised layout.");
  }
  checks.push({ check: "Recognised AgentIdentity layout", status: "PASS", detail: `AgentIdentityV${identity.version}` });

  if (identity.asset !== base.asset) {
    checks.push({ check: "Identity bound to this asset", status: "FAIL", detail: `Stored asset ${identity.asset}` });
    return result("mismatch", "The identity account is bound to a different asset.", { identity });
  }
  checks.push({ check: "Identity bound to this asset", status: "PASS", detail: identity.asset });

  return result("verified", "Live on-chain checks passed: this asset has a registered Metaplex Agent Identity.", { identity });
}

function unavailable(asset: PublicKey, error: unknown): AgentVerification {
  const [pda, bump] = findAgentIdentityPda(asset);
  const message = error instanceof Error ? error.message : String(error);
  return {
    asset: asset.toBase58(),
    status: "unavailable",
    verified: false,
    reason: `Could not reach the Solana RPC: ${message}`,
    identityPda: pda.toBase58(),
    bump,
    identity: null,
    identityAccount: null,
    assetAccount: null,
    checks: [{ check: "RPC reachable", status: "FAIL", detail: message }],
    programId: AGENT_IDENTITY_PROGRAM_ID.toBase58(),
    cluster: getCluster(),
    checkedAt: new Date().toISOString(),
  };
}

/** Verifies several assets with a single getMultipleAccountsInfo call. */
export async function verifyAgentIdentities(
  connection: Connection,
  assets: PublicKey[],
  opts: { timeoutMs?: number; expectedPda?: string | null } = {}
): Promise<AgentVerification[]> {
  if (assets.length === 0) return [];
  const pdas = assets.map(a => findAgentIdentityPda(a)[0]);
  try {
    const infos = await withTimeout(
      connection.getMultipleAccountsInfo([...pdas, ...assets], "confirmed"),
      opts.timeoutMs ?? 8000,
      "getMultipleAccountsInfo"
    );
    return assets.map((asset, i) => evaluateIdentity(asset, infos[i], infos[assets.length + i], opts.expectedPda));
  } catch (e) {
    return assets.map(asset => unavailable(asset, e));
  }
}

export async function verifyAgentIdentity(
  connection: Connection,
  asset: PublicKey,
  opts: { timeoutMs?: number; expectedPda?: string | null } = {}
): Promise<AgentVerification> {
  return (await verifyAgentIdentities(connection, [asset], opts))[0];
}

export type DiscoveredAgent = {
  mintAddress: string;
  name: string;
  description: string;
  image: string | null;
  agentMetadataUri: string | null;
  isActive: boolean | null;
};

/** Discovery via Metaplex's indexed agents API (off-chain index; verify results on-chain). */
export async function discoverAgents(
  query: string,
  opts: { network?: string; pageSize?: number; timeoutMs?: number } = {}
): Promise<{ agents: DiscoveredAgent[]; total: number }> {
  const url = new URL(METAPLEX_AGENTS_API);
  url.searchParams.set("network", opts.network ?? metaplexNetwork());
  if (query) url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(opts.pageSize ?? 6));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Metaplex agents API returned HTTP ${res.status}`);
    const json = await res.json();
    const raw: any[] = Array.isArray(json?.data?.agents) ? json.data.agents : [];
    const agents = raw
      .filter(a => typeof a?.mintAddress === "string" && parsePublicKey(a.mintAddress))
      .map(a => ({
        mintAddress: a.mintAddress as string,
        name: typeof a.name === "string" ? a.name.slice(0, 80) : "Unnamed agent",
        description: typeof a.description === "string" ? a.description.slice(0, 240) : "",
        image: typeof a.image === "string" ? a.image : null,
        agentMetadataUri: typeof a.agentMetadataUri === "string" ? a.agentMetadataUri : null,
        isActive: typeof a.isActive === "boolean" ? a.isActive : null,
      }));
    return { agents, total: typeof json?.data?.total === "number" ? json.data.total : agents.length };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new RpcTimeoutError("Metaplex agents API timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
