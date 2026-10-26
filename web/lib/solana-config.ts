// Browser-safe Solana settings. Only NEXT_PUBLIC_ values belong here.

export const SOLANA_CLUSTER =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" || process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "testnet"
    ? process.env.NEXT_PUBLIC_SOLANA_CLUSTER
    : "devnet";

export const TOURISM_PROGRAM_ID =
  process.env.NEXT_PUBLIC_TOURISM_PROGRAM_ID || "A7yU8i4YBUmnR5fZUxxC88ytFe59XkZGvqN1tj34VSzN";

// Agent asset recorded in each itinerary commitment. The default is a devnet MPL Core asset
// with a registered Metaplex Agent Identity (on-chain name "Test Agent #797"); it is a
// reference identity, not an agent operated by this project.
export const ITINERARY_AGENT_ASSET =
  process.env.NEXT_PUBLIC_ITINERARY_AGENT_ASSET || "CnhuTNUvdwn6aMKjwDFhmQujf1E8j9xqQ2xLCR7ZXXbn";

export function explorerUrl(kind: "tx" | "address", id: string): string {
  const cluster = SOLANA_CLUSTER === "mainnet-beta" ? "" : `?cluster=${SOLANA_CLUSTER}`;
  return `https://explorer.solana.com/${kind}/${id}${cluster}`;
}
