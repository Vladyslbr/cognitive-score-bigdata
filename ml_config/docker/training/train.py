import os
import json
import glob
import statistics
from datetime import datetime, timezone

TRAIN_DIR = "/opt/ml/input/data/train"
MODEL_DIR = "/opt/ml/model"

def safe_float(x):
    try:
        return float(x)
    except Exception:
        return None

def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    files = sorted(glob.glob(os.path.join(TRAIN_DIR, "*.json")))
    records = []

    for fp in files:
        try:
            with open(fp, "r", encoding="utf-8") as f:
                obj = json.load(f)
            if isinstance(obj, dict):
                records.append(obj)
        except Exception:
            continue

    # Мінімальна "логіка навчання": порахуємо статистики по cognitive_scores (якщо є)
    scores = []
    for r in records:
        # у ваших даних поле називається "cognitive_scores" (string) — збережемо як float, якщо можна
        val = r.get("cognitive_scores")
        fv = safe_float(val)
        if fv is not None:
            scores.append(fv)

    meta = {
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "num_files": len(files),
        "num_records": len(records),
        "scores_count": len(scores),
        "scores_mean": statistics.mean(scores) if scores else None,
        "scores_min": min(scores) if scores else None,
        "scores_max": max(scores) if scores else None,
        "model_version": "v1-mock",
    }

    with open(os.path.join(MODEL_DIR, "model_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("Training done. Wrote model_meta.json:", meta)

if __name__ == "__main__":
    main()
