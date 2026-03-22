"""
Posture Detection — Hackathon Starter
Run with: python main.py
  or: python main.py --stream --socket http://192.168.1.192:4000

Controls (webcam mode):
  [c] — Start/stop calibration
  [r] — Reset calibration and score
  [q] — Quit (saves posture_report.csv)

Stream mode logs stats to stdout; no keyboard controls.
"""

import sys
import argparse
import cv2
import numpy as np
import logging
from pose_utils import (
    KEYPOINTS, compute_posture_features,
    PostureMonitor, PostureScoreTracker,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)

# ── Load MoveNet Thunder (lazy-loaded) ────────────────────────────
_movenet_loaded = False
movenet = None

def run_movenet(frame):
    """Run MoveNet on a BGR frame. Returns 17 keypoints as (y, x, conf)."""
    global _movenet_loaded, movenet
    
    # Lazy-load on first call
    if not _movenet_loaded:
        try:
            import tensorflow as tf_module
            import tensorflow_hub as hub_module
            print("Loading MoveNet Thunder... (first run downloads ~30MB)")
            model = hub_module.load("https://tfhub.dev/google/movenet/singlepose/thunder/4")
            movenet = model.signatures["serving_default"]
            _movenet_loaded = True
        except ImportError:
            print("WARNING: TensorFlow not available; using mock inference for testing")
            _movenet_loaded = True  # Don't retry
    
    if movenet is None:
        # Mock mode: return stable realistic keypoints (not random)
        # Format: (y, x, confidence) normalized 0-1
        return np.array([
            [0.15, 0.50, 0.9],  # nose
            [0.12, 0.48, 0.9],  # left_eye
            [0.12, 0.52, 0.9],  # right_eye
            [0.14, 0.44, 0.8],  # left_ear
            [0.14, 0.56, 0.8],  # right_ear
            [0.30, 0.35, 0.9],  # left_shoulder
            [0.30, 0.65, 0.9],  # right_shoulder
            [0.45, 0.25, 0.8],  # left_elbow
            [0.45, 0.75, 0.8],  # right_elbow
            [0.55, 0.30, 0.7],  # left_wrist
            [0.55, 0.70, 0.7],  # right_wrist
            [0.55, 0.40, 0.9],  # left_hip
            [0.55, 0.60, 0.9],  # right_hip
            [0.75, 0.38, 0.8],  # left_knee
            [0.75, 0.62, 0.8],  # right_knee
            [0.90, 0.38, 0.7],  # left_ankle
            [0.90, 0.62, 0.7],  # right_ankle
        ])
    
    # Real inference
    import tensorflow as tf_module
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = tf_module.image.resize_with_pad(tf_module.expand_dims(img, axis=0), 256, 256)
    img = tf_module.cast(img, dtype=tf_module.int32)
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
    if status["overall"] == "good":
        color = (0, 200, 0)  # Green
        label = "GOOD POSTURE"
    elif status["overall"] == "caution":
        color = (0, 165, 255)  # Orange
        label = "CAUTION - Minor issues"
    else:  # "bad"
        color = (0, 0, 255)  # Red
        label = "FIX YOUR POSTURE"
    
    cv2.putText(frame, label, (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 3)

    # ── Score bars ──
    draw_score_bar(frame, tracker.overall_score, 20, 70, 260, 22, "Session")
    draw_score_bar(frame, tracker.rolling_score, 20, 115, 260, 22, "Last 60s")

    # ── Streak timer ──
    streak_s = tracker.streak_seconds
    if tracker.streak_state == "good":
        streak_label = "Good"
        streak_color = (0, 200, 0)
    elif tracker.streak_state == "caution":
        streak_label = "Caution"
        streak_color = (0, 165, 255)
    else:
        streak_label = "Bad"
        streak_color = (0, 0, 255)
    
    mins, secs = divmod(int(streak_s), 60)
    cv2.putText(frame, f"{streak_label} streak: {mins}m {secs:02d}s",
                (20, 168), cv2.FONT_HERSHEY_SIMPLEX, 0.55, streak_color, 1)

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
        # Color code: green=good, orange=caution, red=alert
        if info["status"] == "good":
            mc = (0, 200, 0)
            threshold_display = f"{info['alert_threshold']:.3f}"
        elif info["status"] == "caution":
            mc = (0, 165, 255)
            threshold_display = f"{info['alert_threshold']:.3f}!"
        else:  # alert
            mc = (0, 0, 255)
            threshold_display = f"{info['alert_threshold']:.3f}!!"
        
        text = f"{name}: {info['deviation']:.3f}/{threshold_display}"
        cv2.putText(frame, text, (w - 350, y_off),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, mc, 1)
        y_off += 22


# ── Main loop ─────────────────────────────────────────────────────
def main_webcam():
    """Original mode: read from local webcam, render UI."""
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


def main_stream(socket_url):
    """Stream mode: read from Socket.IO, no UI, log stats."""
    from stream_bridge import StreamBridge
    
    logger = logging.getLogger(__name__)
    
    # Initialize state
    monitor = PostureMonitor(smoothing_window=12)
    tracker = PostureScoreTracker(rolling_window=60)
    calibrating = False
    status = {"overall": "not_calibrated", "details": {}}
    
    # Callback for pose inference results
    def on_inference(frame, keypoints, features):
        nonlocal calibrating, status
        
        if features is None:
            return
        
        if calibrating:
            # In calibration mode, accumulate samples
            monitor.add_calibration_sample(features)
            logger.info(f"[CAL] Collected {len(monitor.calibration_samples)} samples")
            
            # Auto-finish after 30 samples
            if len(monitor.calibration_samples) >= 30:
                calibrating = False
                monitor.finish_calibration()
                tracker = PostureScoreTracker(rolling_window=60)
                logger.info("[CAL] Calibration complete. Monitoring started.")
        else:
            # Evaluate and score
            if status["overall"] != "not_calibrated":
                status = monitor.evaluate(features)
                tracker.record(status)
                
                # Log status changes
                if status["overall"] in ["caution", "bad"]:
                    logger.warning(
                        f"[STATUS] {status['overall'].upper()} — "
                        f"Bad metrics: {status['metrics_in_alert']} alert, "
                        f"{status['metrics_in_caution']} caution"
                    )
    
    # Create bridge
    bridge = StreamBridge(
        socket_url=socket_url,
        run_movenet_fn=run_movenet,
        compute_features_fn=compute_posture_features,
        post_inference_cb=on_inference
    )
    
    # Connect
    logger.info(f"Connecting to {socket_url}...")
    if not bridge.connect():
        logger.error("Failed to connect. Exiting.")
        return
    
    logger.info("Connected. Waiting for calibration trigger from app...")
    
    # Run processing loop (blocks until stop_requested is set)
    # Calibration will be started by frontend via 'calibrate-start' event
    try:
        bridge.process_frames()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        bridge.stop()
        
        # Save summary
        summary = tracker.get_summary()
        logger.info("========== SESSION SUMMARY ==========")
        for k, v in summary.items():
            logger.info(f"  {k}: {v}")
        logger.info("=====================================")
        
        tracker.save_report("posture_report.csv")


def main():
    """Parse args and run either webcam or stream mode."""
    parser = argparse.ArgumentParser(
        description="Posture detection with MoveNet"
    )
    parser.add_argument(
        "--stream",
        action="store_true",
        help="Read frames from Socket.IO relay instead of local webcam"
    )
    parser.add_argument(
        "--socket",
        type=str,
        default="http://localhost:4000",
        help="Socket.IO server URL (default: http://localhost:4000)"
    )
    
    args = parser.parse_args()
    
    if args.stream:
        logger = logging.getLogger(__name__)
        logger.info("Starting in STREAM mode")
        main_stream(args.socket)
    else:
        main_webcam()


if __name__ == "__main__":
    main()