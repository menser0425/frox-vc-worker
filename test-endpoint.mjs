// GPUエンドポイントの通しテスト: 実チャンクをFLACで送り、変換音声が返るか
// 使い方: RUNPOD_API_KEY=... RUNPOD_ENDPOINT_ID=... node test-endpoint.mjs <src.wav> <ref.wav>
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const KEY = process.env.RUNPOD_API_KEY;
const EP = process.env.RUNPOD_ENDPOINT_ID;
const [src, ref] = process.argv.slice(2);
if (!KEY || !EP || !src || !ref) throw new Error("引数不足");

const flac = (p) => {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", p, "-c:a", "flac", p + ".flac"]);
  return fs.readFileSync(p + ".flac");
};

console.log("送信中...（初回はGPUの起動＝コールドスタートで1〜3分かかることがあります）");
const t0 = Date.now();
const res = await fetch(`https://api.runpod.ai/v2/${EP}/runsync`, {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    input: {
      source_b64: flac(src).toString("base64"),
      reference_b64: flac(ref).toString("base64"),
      format: "flac",
      diffusion_steps: 50,
    },
  }),
  signal: AbortSignal.timeout(15 * 60_000),
});
const j = await res.json();
console.log("HTTP", res.status, "/ status:", j.status, "/", ((Date.now() - t0) / 1000).toFixed(1) + "秒");
if (j.status !== "COMPLETED") {
  console.log(JSON.stringify(j).slice(0, 800));
  process.exit(1);
}
fs.writeFileSync("gpu_test_out.flac", Buffer.from(j.output.audio_b64, "base64"));
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", "gpu_test_out.flac", "gpu_test_out.wav"]);
const dur = (f) =>
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim();
console.log(`元: ${dur(src)}秒 / GPU変換後: ${dur("gpu_test_out.wav")}秒`);
console.log("GPU実行時間:", j.executionTime, "ms / 遅延:", j.delayTime, "ms");
