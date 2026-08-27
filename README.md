# frox-vc-worker

Voice Studio の「動画の声変換」で使う声質変換ワーカー（RunPod serverless）。

- 入力: `{ input: { source_b64, reference_b64, format: "flac", diffusion_steps? } }`
- 出力: `{ output: { audio_b64, sample_rate, duration_ms } }`
- エンジン: Seed-VC（タイミング完全保持のゼロショット声質変換）
- モデルはイメージに焼き込み済み（コールドスタートでのダウンロードなし）
