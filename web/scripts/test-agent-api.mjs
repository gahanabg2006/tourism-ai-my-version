// API contract tests for /api/agents and /api/agents/verify against a running server.
// Usage: npm run build && npm start   (in another shell)   then   npm run test:api
// BASE_URL defaults to http://localhost:3000.

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const REGISTERED_V1 = "CnhuTNUvdwn6aMKjwDFhmQujf1E8j9xqQ2xLCR7ZXXbn"; // AgentIdentityV1 on devnet
const REGISTERED_V2 = "5KXXM4PnaKHHbjgKshQgGNhV66srYbnEnqB5L2tY3hGn"; // AgentIdentityV2 on devnet
const UNREGISTERED = "11111111111111111111111111111111"; // System Program: exists, never an agent

let passed = 0;
let total = 0;
function assert(condition, message) {
  total++;
  if (condition) { passed++; console.log(`  ✓ [PASS] ${message}`); }
  else console.error(`  ✗ [FAIL] ${message}`);
}
async function get(path) {
  const res = await fetch(BASE_URL + path, { cache: "no-store" });
  return { status: res.status, body: await res.json().catch(() => null) };
}

console.log(`=== AGENT API CONTRACT TESTS (${BASE_URL}) ===\n`);

console.log("1. /api/agents");
const list = await get("/api/agents");
assert(list.status === 200, "returns HTTP 200");
const agents = list.body?.data?.agents ?? [];
assert(agents.length > 0, `returns agents (${agents.length})`);
assert(agents.every(a => a.verification && typeof a.verification.status === "string"), "every agent carries a verification status");
assert(agents.every(a => !("verifiedOnDevnet" in a) && !("reputation" in a)), "no hardcoded verifiedOnDevnet / reputation fields");
const demo = agents.filter(a => a.kind === "simulated");
assert(demo.length > 0 && demo.every(a => a.mintAddress === null && a.verification.status === "simulated"), "demo personas are labelled simulated with no mint");
const mints = agents.filter(a => a.mintAddress).map(a => a.mintAddress);
assert(new Set(mints).size === mints.length, "no duplicate mint addresses");
assert(agents.filter(a => a.verification.verified).every(a => a.kind === "registry"), "only registry agents can be verified");
assert(list.body?.summary && typeof list.body.summary.verified === "number", "summary counts present");

console.log("\n2. /api/agents/verify — valid inputs");
const v1 = await get(`/api/agents/verify?asset=${REGISTERED_V1}`);
assert(v1.status === 200 && v1.body?.status === "verified" && v1.body?.identity?.version === 1, "AgentIdentityV1 asset verifies");
const v2 = await get(`/api/agents/verify?asset=${REGISTERED_V2}`);
assert(v2.status === 200 && v2.body?.status === "verified" && v2.body?.identity?.version === 2, "AgentIdentityV2 asset verifies");
assert(v1.body && !("reputationScore" in v1.body) && !("sealAttestation" in v1.body), "no fabricated reputation / attestation fields");

console.log("\n3. /api/agents/verify — invalid, unregistered and mismatched inputs");
const missing = await get("/api/agents/verify");
assert(missing.status === 400 && missing.body?.status === "invalid_input", "missing asset → 400");
const bad = await get("/api/agents/verify?asset=not-a-key");
assert(bad.status === 400 && bad.body?.status === "invalid_input", "malformed asset → 400");
const badPda = await get(`/api/agents/verify?asset=${REGISTERED_V1}&identityPda=xyz`);
assert(badPda.status === 400, "malformed identityPda → 400");
const unreg = await get(`/api/agents/verify?asset=${UNREGISTERED}`);
assert(unreg.status === 200 && unreg.body?.status === "unregistered" && unreg.body?.verified === false, "unregistered asset → status unregistered");
const mismatch = await get(`/api/agents/verify?asset=${REGISTERED_V1}&identityPda=${REGISTERED_V2}`);
assert(mismatch.status === 200 && mismatch.body?.status === "mismatch" && mismatch.body?.verified === false, "wrong identityPda → status mismatch");

console.log(`\nAPI TEST SUMMARY: ${passed} / ${total} checks passed`);
if (passed !== total) process.exit(1);
