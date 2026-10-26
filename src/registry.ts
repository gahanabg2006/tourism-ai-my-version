// Single source of truth for Metaplex Agent Registry logic lives with the web app,
// which is where it runs (API routes). Re-exported here for scripts and tooling.
export {
  AGENT_IDENTITY_PROGRAM_ID,
  AGENT_IDENTITY_PROGRAM_ID as METAPLEX_AGENT_REGISTRY_PROGRAM_ID,
  MPL_CORE_PROGRAM_ID,
  discoverAgents,
  evaluateIdentity,
  findAgentIdentityPda,
  parseAgentIdentityAccount,
  parseCoreAssetMetadata,
  verifyAgentIdentities,
  verifyAgentIdentity,
  type AgentVerification,
  type DiscoveredAgent,
  type ParsedIdentity,
  type VerificationStatus,
} from "../web/lib/agent-registry.js";
