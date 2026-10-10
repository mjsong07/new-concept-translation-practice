from __future__ import annotations

import difflib
import re
import threading
from collections import Counter
from typing import Any

import gradio as gr
import numpy as np
import spaces
import torch
import webrtcvad
from faster_whisper import WhisperModel
from phonemizer import phonemize
from phonemizer.separator import Separator
from scipy.signal import resample_poly
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

MAX_AUDIO_SECONDS = 20
MAX_REFERENCE_CHARS = 500
MODEL_ID = "facebook/wav2vec2-lv-60-espeak-cv-ft"
WHISPER_ID = "base.en"
model_lock = threading.Lock()
wav2vec_processor = Wav2Vec2Processor.from_pretrained(MODEL_ID, cache_dir=".cache/models")
wav2vec_model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID, cache_dir=".cache/models").eval().to("cuda")
whisper_model: WhisperModel | None = None


def get_whisper_model() -> WhisperModel:
    global whisper_model
    with model_lock:
        if whisper_model is None:
            whisper_model = WhisperModel(
                WHISPER_ID,
                device="cpu",
                compute_type="int8",
                download_root=".cache/whisper",
            )
    return whisper_model


def normalize_audio(audio: tuple[int, np.ndarray] | None) -> np.ndarray:
    if audio is None or len(audio) != 2:
        raise ValueError("Record audio before submitting.")
    sample_rate, samples = audio
    if not isinstance(sample_rate, int) or sample_rate <= 0:
        raise ValueError("The recorded audio has an invalid sample rate.")
    waveform = np.asarray(samples, dtype=np.float32)
    if waveform.ndim == 2:
        waveform = waveform.mean(axis=1 if waveform.shape[0] > waveform.shape[1] else 0)
    waveform = waveform.reshape(-1)
    if not waveform.size:
        raise ValueError("The recorded audio is empty.")
    duration = waveform.size / sample_rate
    if duration > MAX_AUDIO_SECONDS:
        raise ValueError("Audio must be 20 seconds or shorter.")
    if sample_rate != 16000:
        waveform = resample_poly(waveform, 16000, sample_rate).astype(np.float32)
    return waveform


def word_tokens(text: str) -> list[str]:
    return re.findall(r"[a-z]+(?:['’][a-z]+)?|[0-9]+", text.lower())


def align_words(reference: str, recognized: str) -> list[dict[str, Any]]:
    expected = word_tokens(reference)
    actual = word_tokens(recognized)
    matcher = difflib.SequenceMatcher(a=expected, b=actual, autojunk=False)
    rows: list[dict[str, Any]] = []
    for opcode, start_a, end_a, start_b, end_b in matcher.get_opcodes():
        if opcode == "equal":
            rows.extend(
                {"expected": expected[i], "recognized": actual[start_b + i - start_a], "status": "correct"}
                for i in range(start_a, end_a)
            )
        elif opcode == "replace":
            count = max(end_a - start_a, end_b - start_b)
            for offset in range(count):
                expected_word = expected[start_a + offset] if start_a + offset < end_a else None
                actual_word = actual[start_b + offset] if start_b + offset < end_b else None
                if expected_word:
                    rows.append(
                        {
                            "expected": expected_word,
                            "recognized": actual_word,
                            "status": "wrong" if actual_word else "missing",
                        }
                    )
                elif actual_word:
                    rows.append({"expected": None, "recognized": actual_word, "status": "extra"})
        elif opcode == "delete":
            rows.extend(
                {"expected": expected[i], "recognized": None, "status": "missing"}
                for i in range(start_a, end_a)
            )
        elif opcode == "insert":
            rows.extend(
                {"expected": None, "recognized": actual[i], "status": "extra"}
                for i in range(start_b, end_b)
            )
    return rows


def phoneme_targets(text: str, accent: str, processor: Wav2Vec2Processor) -> tuple[list[int], list[int]]:
    language = "en-gb" if accent == "en-GB" else "en-us"
    words = word_tokens(text)
    all_ids: list[int] = []
    owners: list[int] = []
    for word_index, word in enumerate(words):
        phonetic = phonemize(
            [word],
            language=language,
            backend="espeak",
            separator=Separator(phone=" ", word="", syllable=""),
            strip=True,
            preserve_punctuation=False,
            with_stress=False,
        )[0]
        ids = processor.tokenizer(phonetic, add_special_tokens=False).input_ids
        for token_id in ids:
            if token_id != processor.tokenizer.pad_token_id:
                all_ids.append(token_id)
                owners.append(word_index)
    return all_ids, owners


def forced_phone_scores(
    logits: torch.Tensor, targets: list[int], processor: Wav2Vec2Processor
) -> tuple[list[float], list[str | None]]:
    if not targets:
        return [], []
    log_probs = torch.log_softmax(logits[0], dim=-1).cpu().numpy()
    predicted = np.argmax(log_probs, axis=-1)
    blank = processor.tokenizer.pad_token_id
    expanded = [blank]
    for token in targets:
        expanded.extend([token, blank])
    frames, states = log_probs.shape[0], len(expanded)
    trellis = np.full((frames, states), -np.inf, dtype=np.float32)
    back = np.full((frames, states), -1, dtype=np.int8)
    trellis[0, 0] = log_probs[0, blank]
    if states > 1:
        trellis[0, 1] = log_probs[0, expanded[1]]
    for frame in range(1, frames):
        for state, token in enumerate(expanded):
            best_state = state
            best = trellis[frame - 1, state]
            if state > 0 and trellis[frame - 1, state - 1] > best:
                best_state = state - 1
                best = trellis[frame - 1, best_state]
            if (
                state > 1
                and token != blank
                and token != expanded[state - 2]
                and trellis[frame - 1, state - 2] > best
            ):
                best_state = state - 2
                best = trellis[frame - 1, best_state]
            trellis[frame, state] = best + log_probs[frame, token]
            back[frame, state] = best_state
    state = states - 1 if trellis[-1, states - 1] >= trellis[-1, states - 2] else states - 2
    state_path: list[int] = []
    for frame in range(frames - 1, -1, -1):
        state_path.append(state)
        if frame:
            previous = int(back[frame, state])
            if previous >= 0:
                state = previous
    state_path.reverse()

    scores: list[list[float]] = [[] for _ in targets]
    alternatives: list[list[int]] = [[] for _ in targets]
    for frame, state in enumerate(state_path):
        if state % 2 == 0:
            continue
        target_index = state // 2
        target = targets[target_index]
        scores[target_index].append(float(np.exp(log_probs[frame, target])))
        if predicted[frame] != target and predicted[frame] != blank:
            alternatives[target_index].append(int(predicted[frame]))
    vocab = processor.tokenizer
    average_scores = [float(np.mean(values)) if values else 0.0 for values in scores]
    detected = []
    for tokens in alternatives:
        if not tokens:
            detected.append(None)
        else:
            token_id, count = Counter(tokens).most_common(1)[0]
            detected.append(vocab.convert_ids_to_tokens(token_id) if count / len(tokens) >= 0.5 else None)
    return average_scores, detected


def fluency_metrics(audio: np.ndarray, recognized_words: int, word_times: list[tuple[float, float]]) -> dict[str, Any]:
    vad = webrtcvad.Vad(2)
    pcm = np.clip(audio * 32767, -32768, 32767).astype("<i2")
    frame_samples = 480
    voiced = []
    for start in range(0, len(pcm) - frame_samples + 1, frame_samples):
        voiced.append(vad.is_speech(pcm[start : start + frame_samples].tobytes(), 16000))
    duration = len(audio) / 16000
    speech_seconds = sum(voiced) * 0.03
    pauses = sum(
        1
        for previous, current in zip(word_times, word_times[1:])
        if current[0] - previous[1] >= 0.6
    )
    wpm = recognized_words / max(speech_seconds / 60, 1 / 60)
    rate_score = max(0, 100 - abs(wpm - 120) * 0.5)
    pause_score = max(0, 100 - pauses * 12 - max(0, duration - speech_seconds) / max(duration, 1) * 45)
    return {
        "score": round((rate_score * 0.55 + pause_score * 0.45)),
        "words_per_minute": round(wpm),
        "long_pauses": pauses,
    }


def transcribe_audio(audio: np.ndarray, whisper: WhisperModel) -> tuple[str, list[tuple[float, float]]]:
    segments, _ = whisper.transcribe(
        audio,
        word_timestamps=True,
        vad_filter=True,
        language="en",
        beam_size=1,
    )
    recognized_segments = list(segments)
    transcript = " ".join(segment.text.strip() for segment in recognized_segments).strip()
    word_times = [
        (float(word.start), float(word.end))
        for segment in recognized_segments
        for word in (segment.words or [])
    ]
    return transcript, word_times


@spaces.GPU(duration=45)
def score_phones(
    audio: np.ndarray, targets: list[int]
) -> tuple[list[float], list[str | None]]:
    input_values = wav2vec_processor(audio, sampling_rate=16000, return_tensors="pt").input_values.to("cuda")
    with torch.inference_mode():
        logits = wav2vec_model(input_values).logits
    return forced_phone_scores(logits, targets, wav2vec_processor)


def evaluate(audio: np.ndarray, reference: str, accent: str) -> dict[str, Any]:
    processor = wav2vec_processor
    whisper = get_whisper_model()
    transcript, word_times = transcribe_audio(audio, whisper)
    if not transcript:
        return {"error": "No speech could be recognized. Please record again."}
    word_results = align_words(reference, transcript)
    targets, owners = phoneme_targets(reference, accent, processor)
    phone_scores, phone_alternatives = score_phones(audio, targets)
    expected_count = len(word_tokens(reference))
    pronunciation_by_word: list[list[float]] = [[] for _ in range(expected_count)]
    diagnostic_by_word: list[list[dict[str, str]]] = [[] for _ in range(expected_count)]
    for index, owner in enumerate(owners):
        if owner >= expected_count:
            continue
        pronunciation_by_word[owner].append(phone_scores[index])
        if phone_alternatives[index]:
            expected_phone = processor.tokenizer.convert_ids_to_tokens(targets[index])
            diagnostic_by_word[owner].append(
                {"expected": expected_phone, "heard": phone_alternatives[index] or ""}
            )

    pronunciations = [
        round(100 * float(np.mean(scores))) if scores else 0
        for scores in pronunciation_by_word
    ]
    result_index = 0
    for row in word_results:
        if row["expected"] is None:
            continue
        phone_score = pronunciations[result_index] if result_index < len(pronunciations) else 0
        details = diagnostic_by_word[result_index] if result_index < len(diagnostic_by_word) else []
        result_index += 1
        row["pronunciation_score"] = phone_score
        row["phonemes"] = details
        if row["status"] == "correct" and phone_score < 45:
            row["status"] = "wrong"
        elif row["status"] == "correct" and phone_score < 68:
            row["status"] = "close"

    completeness_score = round(
        100
        * sum(1 for row in word_results if row["status"] in {"correct", "close", "wrong"})
        / max(expected_count, 1)
    )
    pronunciation_score = round(float(np.mean(pronunciations))) if pronunciations else 0
    fluency = fluency_metrics(
        audio,
        len(word_tokens(transcript)),
        word_times,
    )
    accuracy_score = round(pronunciation_score * 0.7 + completeness_score * 0.3)
    overall = round(accuracy_score * 0.55 + completeness_score * 0.25 + fluency["score"] * 0.20)
    return {
        "overall_score": overall,
        "pronunciation_score": pronunciation_score,
        "completeness_score": completeness_score,
        "fluency_score": fluency["score"],
        "transcription": transcript,
        "word_results": word_results,
        "fluency": {
            "words_per_minute": fluency["words_per_minute"],
            "long_pauses": fluency["long_pauses"],
            "audio_duration_seconds": round(len(audio) / 16000, 2),
        },
    }


def evaluate_pronunciation(
    audio: tuple[int, np.ndarray] | None,
    reference_text: str,
    accent: str,
) -> dict[str, Any]:
    reference = reference_text.strip()
    if not reference or len(reference) > MAX_REFERENCE_CHARS or not word_tokens(reference):
        return {"error": "Reference text must contain 1–500 English characters."}
    if accent not in {"en-US", "en-GB"}:
        return {"error": "Accent must be en-US or en-GB."}
    try:
        waveform = normalize_audio(audio)
        return evaluate(waveform, reference, accent)
    except ValueError as error:
        return {"error": str(error)}
    except Exception as error:
        return {"error": f"Pronunciation evaluation failed: {error}"}


with gr.Blocks(title="Pronunciation Evaluation API", delete_cache=(60, 60)) as demo:
    gr.Markdown("# Pronunciation Evaluation\nRecord a short English phrase or call this Space through the Gradio client API.")
    audio_input = gr.Audio(label="Recording", type="numpy", sources=["microphone", "upload"])
    reference_input = gr.Textbox(label="Reference text", max_length=MAX_REFERENCE_CHARS)
    accent_input = gr.Dropdown(["en-US", "en-GB"], value="en-US", label="Accent")
    evaluate_button = gr.Button("Evaluate", variant="primary")
    result_output = gr.JSON(label="Evaluation")
    evaluate_button.click(
        evaluate_pronunciation,
        inputs=[audio_input, reference_input, accent_input],
        outputs=result_output,
        api_name="evaluate_pronunciation",
        concurrency_limit=1,
    )

demo.queue(default_concurrency_limit=1)
demo.launch(server_name="0.0.0.0", max_file_size="10mb")
