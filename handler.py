# RunPod serverless: 音声チャンクの声質変換ワーカー
# 入力: { source_b64, reference_b64, format: "flac"|"wav", diffusion_steps? }
# 出力: { audio_b64 (flac), sample_rate }
import base64
import io
import os
import tempfile

import numpy as np
import soundfile as sf
import runpod
from seed_vc_wrapper import SeedVCWrapper

# モデルはコールドスタート時に1回だけ読み込む
wrapper = SeedVCWrapper()
SR_OUT = 22050


def _convert(src_path, ref_path, steps):
    # convert_voice はジェネレータ（stream_output=False でも return値はStopIterationに載る）
    gen = wrapper.convert_voice(
        src_path, ref_path,
        diffusion_steps=steps, length_adjust=1.0,
        inference_cfg_rate=0.7, f0_condition=False, stream_output=False,
    )
    audio = None
    try:
        while True:
            next(gen)
    except StopIteration as stop:
        audio = stop.value
    if audio is None:
        raise RuntimeError("conversion produced no audio")
    return np.asarray(audio, dtype=np.float32)


def handler(event):
    inp = event.get("input") or {}
    fmt = (inp.get("format") or "flac").lower()
    if fmt not in ("flac", "wav"):
        return {"error": "format must be flac or wav"}
    if not inp.get("source_b64") or not inp.get("reference_b64"):
        return {"error": "source_b64 and reference_b64 are required"}
    steps = max(10, min(100, int(inp.get("diffusion_steps") or 50)))

    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "src." + fmt)
        ref = os.path.join(td, "ref." + fmt)
        with open(src, "wb") as f:
            f.write(base64.b64decode(inp["source_b64"]))
        with open(ref, "wb") as f:
            f.write(base64.b64decode(inp["reference_b64"]))

        audio = _convert(src, ref, steps)

    buf = io.BytesIO()
    sf.write(buf, audio, SR_OUT, format="FLAC")
    return {
        "audio_b64": base64.b64encode(buf.getvalue()).decode(),
        "sample_rate": SR_OUT,
        "duration_ms": int(len(audio) / SR_OUT * 1000),
    }


runpod.serverless.start({"handler": handler})
