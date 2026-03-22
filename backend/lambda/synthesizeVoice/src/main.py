import multiprocessing
from pathlib import Path

from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile

# 環境変数定義
ONNX_RUNTIME_PATH = "voicevox/onnxruntime/lib/libvoicevox_onnxruntime.so"
MODEL_PATH = "voicevox/model/0.vvm"
OPEN_JTALK_PATH = "voicevox/open_jtalk"
MODEL_STYLE_ID = 0  # あまあま
EXPORT_VOICE_FILE_PATH = "/tmp/output.wav"

# 1. Synthesizerの初期化
## Lambdaの場合は1,769MBで1vCPU相当
synthesizer = Synthesizer(
    Onnxruntime.load_once(filename=ONNX_RUNTIME_PATH),
    OpenJtalk(OPEN_JTALK_PATH),
    acceleration_mode="CPU",
    cpu_num_threads=multiprocessing.cpu_count(),
)

# 2. 音声モデルの読み込み
with VoiceModelFile.open(MODEL_PATH) as model:
    synthesizer.load_voice_model(model)


def handler(event, context):
    # 3. テキスト音声合成
    text = "サンプル音声です"
    wav = synthesizer.tts(text, MODEL_STYLE_ID)
    with Path(EXPORT_VOICE_FILE_PATH).open("wb") as f:
        f.write(wav)
