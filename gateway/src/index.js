import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import soap from "soap";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config via ENV (docker-compose) ---
const REST_CLAIM_URL = process.env.REST_CLAIM_URL || "http://claim-service:8081";
const SOAP_WSDL_URL  = process.env.SOAP_WSDL_URL  || "http://identity-soap:8082/ws/identity?wsdl";
const GRAPHQL_URL    = process.env.GRAPHQL_URL    || "http://policy-graphql:8083/graphql";
const GRPC_ADDR      = process.env.GRPC_ADDR      || "fraud-grpc:9090";
const GRPC_PROTO     = process.env.GRPC_PROTO     || "/app/proto/fraud.proto";
const GRPC_PKG       = process.env.GRPC_PKG       || "fraud";            // à adapter
const GRPC_SVC       = process.env.GRPC_SVC       || "FraudService";     // à adapter
const GRPC_METHOD    = process.env.GRPC_METHOD    || "analyzeClaim";     // à adapter

// --- Static UI ---
app.use("/", express.static(path.join(__dirname, "../public")));

// ---------------- REST ----------------
app.post("/api/rest/claim", async (req, res) => {
  try {
    const r = await fetch(`${REST_CLAIM_URL}/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json({ ok: r.ok, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------------- SOAP ----------------
app.post("/api/soap/verify", async (req, res) => {
  try {
    const client = await soap.createClientAsync(SOAP_WSDL_URL);

    // ⚠️ adapte le nom de la méthode selon ton WSDL (ex: verifyIdentity)
    const [result] = await client.verifyIdentityAsync(req.body);

    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------------- GraphQL ----------------
app.post("/api/graphql/policy", async (req, res) => {
  try {
    const query = req.body?.query;
    const variables = req.body?.variables ?? {};

    const r = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const data = await r.json();
    res.status(r.status).json({ ok: r.ok, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------------- gRPC ----------------
function grpcClient() {
  const def = protoLoader.loadSync(GRPC_PROTO, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const pkg = grpc.loadPackageDefinition(def);

  // Trouve pkg + service dynamiquement (simple)
  const pkgObj = pkg[GRPC_PKG];
  if (!pkgObj) throw new Error(`Package gRPC introuvable: ${GRPC_PKG}`);

  const SvcCtor = pkgObj[GRPC_SVC];
  if (!SvcCtor) throw new Error(`Service gRPC introuvable: ${GRPC_PKG}.${GRPC_SVC}`);

  return new SvcCtor(GRPC_ADDR, grpc.credentials.createInsecure());
}

app.post("/api/grpc/fraud", async (req, res) => {
  try {
    const c = grpcClient();

    // Appel méthode (ex: analyzeClaim)
    c[GRPC_METHOD](req.body, (err, resp) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, data: resp });
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// -------- Orchestration “mini workflow” (sans Flowable) --------
app.post("/api/process", async (req, res) => {
  try {
    const payload = req.body;

    // 1) REST create claim
    const rest = await fetch(`${REST_CLAIM_URL}/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const claim = await rest.json();
    if (!rest.ok) return res.status(400).json({ ok: false, step: "REST", claim });

    // 2) SOAP verify
    const soapClient = await soap.createClientAsync(SOAP_WSDL_URL);
    const [soapRes] = await soapClient.verifyIdentityAsync({
      customerId: payload.customerId,
      fullName: payload.fullName,
      policyNumber: payload.policyNumber
    });

    // 3) GraphQL policy validate (exemple)
    const query = `
      query Validate($policyNumber: String!, $claimType: String!) {
        validatePolicy(policyNumber: $policyNumber, claimType: $claimType) {
          valid
          covered
          message
        }
      }
    `;
    const gq = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { policyNumber: payload.policyNumber, claimType: payload.claimType } }),
    });
    const graphql = await gq.json();

    // 4) gRPC fraud
    const c = grpcClient();
    const fraud = await new Promise((resolve, reject) => {
      c[GRPC_METHOD](
        { claimId: claim.id ?? claim.claimId ?? "unknown", amount: payload.amount ?? 0 },
        (err, resp) => (err ? reject(err) : resolve(resp))
      );
    });

    res.json({
      ok: true,
      claim,
      identity: soapRes,
      policy: graphql,
      fraud
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const PORT = process.env.PORT || 8090;
app.listen(PORT, () => console.log(`Gateway running on :${PORT}`));
