"""
Posture Detection — Hackathon Starter
Run with: python main.py

Controls:
  [c] — Start/stop calibration
  [r] — Reset calibration and score
  [q] — Quit (saves posture_report.csv)
"""

import cv2
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub
from pose_utils import (
    KEYPOINTS, compute_posture_features,
    PostureMonitor, PostureScoreTracker,
)

# ── Load MoveNet Thunder ──────────────────────────────────────────
print("Loading MoveNet Thunder... (first run downloads ~30MB)")
model = hub.load("https://tfhub.dev/google/movenet/singlepose/thunder/4")
movenet = model.signatures["serving_default"]


def run_movenet(frame):
    """Run MoveNet on a BGR frame. Returns 17 keypoints as (y, x, conf)."""
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = tf.image.resize_with_pad(tf.expand_dims(img, axis=0), 256, 256)
    img = tf.cast(img, dtype=tf.int32)
    outputs = movenet(img)
    return outputs["output_0"].numpy()[0, 0, :, :]


# ── Drawing helpers ───────────────────────────────────────────────
SKELETON_EDGES = [
    ("left_ear", "left_eye"), ("right_ear", "right_eye"),
    ("left_eye", "nose"), ("right_eye", "nose"),
    ("left_shoulder", "right_shoulder"),
    ("left_shoulder", "left_elbow"), ("right_shoulder", "right_elbow"),
    ("left_elbow", "left_wrist"), ("right_elbow", "right_wrist"),
    ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"),
    ("left_hip", "right_hip"),
]


def draw_skeleton(frame, keypoints, confidence_thresh=0.3):
    h, w, _ = frame.shape
    for i, (ky, kx, kc) in enumerate(keypoints):
        if kc > confidence_thresh:
            cx, cy = int(kx * w), int(ky * h)
            cv2.circle(frame, (cx, cy), 5, (0, 255, 255), -1)

    for p1_name, p2_name in SKELETON_EDGES:
        i1, i2 = KEYPOINTS[p1_name], KEYPOINTS[p2_name]
        y1, x1, c1 = keypoints[i1]
        y2, x2, c2 = keypoints[i2]
        if c1 > confidence_thresh and c2 > confidence_thresh:
            pt1 = (int(x1 * w), int(y1 * h))
            pt2 = (int(x2 * w), int(y2 * h))
            cv2.line(frame, pt1, pt2, (0, 255, 0), 2)


def score_color(score):
    """Green at 100%, red at 0%, yellow in between."""
    r = int(255 * (1 - score / 100))
    g = int(255 * (score / 100))
    return (0, g, r)


def draw_score_bar(frame, score, x, y, w, h, label):
    """Draw a labeled horizontal progress bar."""
    cv2.rectangle(frame, (x, y), (x + w, y + h), (60, 60, 60), -1)
    fill_w = int(w * score / 100)
    color = score_color(score)
    cv2.rectangle(frame, (x, y), (x + fill_w, y + h), color, -1)
    cv2.rectangle(frame, (x, y), (x + w, y + h), (180, 180, 180), 1)
    cv2.putText(frame, f"{label}: {score:.0f}%",
                (x, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1)


def draw_hud(frame, status, tracker, calibrating, cal_count):
    """Draw the full heads-up display."""
    h, w, _ = frame.shape

    # ── Calibration mode ──
    if calibrating:
        cv2.putText(frame, f"CALIBRATING... ({cal_count} samples)",
                    (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 255), 2)
        cv2.putText(frame, "Sit in your BEST posture. Press [c] to finish.",
                    (20, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 1)
        return

    # ── Not calibrated yet ──
    if status["overall"] == "not_calibrated":
        cv2.putText(frame, "Press [c] to calibrate your posture",
                    (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)
        return

    # ── No pose visible ──
    if status["overall"] == "no_pose":
        cv2.putText(frame, "No pose detected", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        return

    # ── Posture status banner ──
    color = (0, 200, 0) if status["overall"] == "good" else (0, 0, 255)
    label = "GOOD POSTURE" if status["overall"] == "good" else "FIX YOUR POSTURE"
    cv2.putText(frame, label, (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 3)

    # ── Score bars ──
    draw_score_bar(frame, tracker.overall_score, 20, 70, 260, 22, "Session")
    draw_score_bar(frame, tracker.rolling_score, 20, 115, 260, 22, "Last 60s")

    # ── Streak timer ──
    streak_s = tracker.streak_seconds
    streak_label = "Good" if tracker.streak_state == "good" else "Bad"
    mins, secs = divmod(int(streak_s), 60)
    cv2.putText(frame, f"{streak_label} streak: {mins}m {secs:02d}s",
                (20, 168), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)

    # ── Session duration ──
    dur = tracker.session_duration
    d_min, d_sec = divmod(int(dur), 60)
    cv2.putText(frame, f"Session: {d_min}m {d_sec:02d}s",
                (20, 195), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)

    # ── Worst metric callout ──
    worst = tracker.worst_metric
    if worst:
        friendly_names = {
            "shoulder_width": "Too close/far from screen",
            "shoulder_tilt": "Leaning sideways",
            "head_drop_ratio": "Slouching down",
            "forward_head_ratio": "Head too far forward",
            "head_tilt": "Tilting head",
        }
        cv2.putText(frame, f"Most common issue: {friendly_names.get(worst, worst)}",
                    (20, 222), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 180, 255), 1)

    # ── Per-metric breakdown (right side) ──
    y_off = 40
    for name, info in status["details"].items():
        mc = (0, 200, 0) if info["status"] == "good" else (0, 0, 255)
        text = f"{name}: {info['deviation']:.3f}/{info['threshold']:.3f}"
        cv2.putText(frame, text, (w - 350, y_off),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, mc, 1)
        y_off += 22


# ── Main loop ─────────────────────────────────────────────────────
def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Cannot open webcam.")
        return

    monitor = PostureMonitor(smoothing_window=12)
    tracker = PostureScoreTracker(rolling_window=60)
    calibrating = False
    status = {"overall": "not_calibrated", "details": {}}

    print("Webcam opened. Press [c] to calibrate, [r] to reset, [q] to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        keypoints = run_movenet(frame)
        features = compute_posture_features(keypoints)

        draw_skeleton(frame, keypoints)

        if calibrating:
            monitor.add_calibration_sample(features)
            draw_hud(frame, status, tracker, True, len(monitor.calibration_samples))
        else:
            status = monitor.evaluate(features)
            tracker.record(status)
            draw_hud(frame, status, tracker, False, 0)

        cv2.imshow("Posture Monitor", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key == ord("c"):
            if not calibrating:
                calibrating = True
                monitor.calibration_samples = []
                print("Calibration started — sit up straight!")
            else:
                calibrating = False
                monitor.finish_calibration()
                tracker = PostureScoreTracker(rolling_window=60)
                print("Calibration complete. Monitoring + scoring started.")
        elif key == ord("r"):
            monitor = PostureMonitor(smoothing_window=12)
            tracker = PostureScoreTracker(rolling_window=60)
            calibrating = False
            status = {"overall": "not_calibrated", "details": {}}
            print("Reset. Press [c] to recalibrate.")

    # ── Session over — save report ────────────────────────────────
    cap.release()
    cv2.destroyAllWindows()

    summary = tracker.get_summary()
    print("\n========== SESSION SUMMARY ==========")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print("=====================================\n")

    tracker.save_report("posture_report.csv")


if __name__ == "__main__":
    main()