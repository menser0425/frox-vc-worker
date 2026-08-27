// runsyncがタイムアウトした場合の続き: ジョブIDの完了を待って結果を保存
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const KEY = process.env.RUNPOD_API_KEY, EP = process.env.RUNPOD_ENDPOINT_ID, ID = process.argv[2];
const t0 = Date.now();
for (;;) {
  const r = await fetch(`https://api.runpod.ai/v2/${EP}/status/${ID}`, {
    headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(60000),
  });
  const j = await r.json();
  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  if (j.status === "COMPLETED") {
    fs.writeFileSync("gpu_test_out.flac", Buffer.from(j.output.audio_b64, "base64"));
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", "gpu_test_out.flac", "gpu_test_out.wav"]);
    const dur = (f) => execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0",f]).toString().trim();
    console.log(`完了(${sec}秒) / GPU実行 ${j.executionTime}ms / 遅延 ${j.delayTime}ms`);
    console.log(`変換後の長さ: ${dur("gpu_test_out.wav")}秒（元は30秒）`);
    break;
  }
  if (j.status === "FAILED" || j.status === "CANCELLED") {
    console.log("失敗:", JSON.stringify(j).slice(0, 600));
    process.exit(1);
  }
  if (Date.now() - t0 > 20 * 60_000) { console.log("20分待っても完了せず:", j.status); process.exit(1); }
  await new Promise((s) => setTimeout(s, 10000));
}
