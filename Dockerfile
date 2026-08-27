# 音声チャンクの声質変換ワーカー（RunPod serverless用）
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

RUN apt-get update && apt-get install -y --no-install-recommends git ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# 検証済みのコミットに固定する（勝手に変わって壊れないように）
RUN git clone https://github.com/Plachtaa/seed-vc . && git checkout 51383efd921027683c89e5348211d93ff12ac2a8

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# モデル一式をイメージに焼き込む（コールドスタート時のダウンロードを無くす）
# 実際のコードパス（SeedVCWrapper）で読み込ませるので、必要な物が過不足なく入る
RUN python -c "import torch; from seed_vc_wrapper import SeedVCWrapper; SeedVCWrapper(device=torch.device('cpu')); print('prefetch ok')"

COPY handler.py /app/handler.py
CMD ["python", "-u", "handler.py"]
