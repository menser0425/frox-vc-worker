// RunPodにサーバーレスのGPUエンドポイントを作成する
// 使い方: RUNPOD_API_KEY=... node create-endpoint.mjs
const KEY = process.env.RUNPOD_API_KEY;
if (!KEY) throw new Error("RUNPOD_API_KEY を設定してください");

const gql = async (query) => {
  const r = await fetch("https://api.runpod.io/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 500));
  return j.data;
};

// 既にあれば使い回す（二重作成しない）
const existing = await gql(`{ myself { endpoints { id name } } }`);
const found = (existing.myself.endpoints || []).find((e) => e.name.startsWith("voice-studio-vc"));
if (found) {
  console.log("既存エンドポイントを使用:", found.id);
  process.exit(0);
}

// テンプレート（どのイメージをどう動かすか）
const tpl = await gql(`mutation {
  saveTemplate(input: {
    name: "voice-studio-vc-worker",
    imageName: "ghcr.io/menser0425/froxvc:latest",
    containerDiskInGb: 25,
    dockerArgs: "",
    env: [],
    isServerless: true,
    volumeInGb: 0,
    ports: ""
  }) { id name }
}`);
const templateId = tpl.saveTemplate.id;
console.log("テンプレート作成:", templateId);

// エンドポイント（GPUの種類・並列数・待機設定）
// workersMin 0 = 使わないとき0円 / idleTimeout 5分 = 連続チャンクで再起動を繰り返さない
const ep = await gql(`mutation {
  saveEndpoint(input: {
    name: "voice-studio-vc",
    templateId: "${templateId}",
    gpuIds: "ADA_24,AMPERE_24",
    workersMin: 0,
    workersMax: 2,
    idleTimeout: 300,
    scalerType: "QUEUE_DELAY",
    scalerValue: 4
  }) { id name }
}`);
console.log("エンドポイント作成:", ep.saveEndpoint.id);
console.log("RUNPOD_ENDPOINT_ID=" + ep.saveEndpoint.id);
