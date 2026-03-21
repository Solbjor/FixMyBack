import time
import csv
import numpy as np
from collections import deque

# MoveNet keypoint indices
KEYPOINTS = {
    "nose": 0, "left_eye": 1, "right_eye": 2,
    "left_ear": 3, "right_ear": 4, "left_shoulder": 5,
    "right_shoulder": 6, "left_elbow": 7, "right_elbow": 8,
    "left_wrist": 9, "right_wrist": 10, "left_hip": 11,
    "right_hip": 12, "left_knee": 13, "right_knee": 14,
    "left_ankle": 15, "right_ankle": 16
}

# Minimum confidence to trust a keypoint
CONFIDENCE_THRESHOLD = 0.3


def get_point(keypoints, name):
    """Extract (x, y, confidence) for a named keypoint."""
    idx = KEYPOINTS[name]
    y, x, conf = keypoints[idx]
    return np.array([x, y]), conf


def midpoint(p1, p2):
    return (p1 + p2) / 2.0


def angle_with_horizontal(p1, p2):
    """Angle in degrees of the line p1->p2 relative to horizontal."""
    delta = p2 - p1
    return np.degrees(np.arctan2(delta[1], delta[0]))


def euclidean(p1, p2):
    return np.linalg.norm(p1 - p2)


def compute_posture_features(keypoints):
    """
    Compute upper-body posture features from MoveNet keypoints.
    Returns a dict of features, or None if key points aren't visible.

    Features (all using upper body only — no hips needed):
      - shoulder_width:    pixel dist between shoulders (proximity proxy)
      - shoulder_tilt:     angle of shoulder line vs horizontal (lateral lean)
      - head_drop_ratio:   vertical nose-to-shoulder-midpoint / shoulder_width
      - forward_head_ratio: horizontal ear-midpoint-to-shoulder-midpoint / shoulder_width
      - head_tilt:         angle of ear line vs horizontal
    """
    l_sh, l_sh_c = get_point(keypoints, "left_shoulder")
    r_sh, r_sh_c = get_point(keypoints, "right_shoulder")
    nose, nose_c = get_point(keypoints, "nose")
    l_ear, l_ear_c = get_point(keypoints, "left_ear")
    r_ear, r_ear_c = get_point(keypoints, "right_ear")

    # Bail out if shoulders or nose aren't visible
    if l_sh_c < CONFIDENCE_THRESHOLD or r_sh_c < CONFIDENCE_THRESHOLD:
        return None
    if nose_c < CONFIDENCE_THRESHOLD:
        return None

    sh_mid = midpoint(l_sh, r_sh)
    sh_width = euclidean(l_sh, r_sh)

    if sh_width < 1e-5:
        return None  # degenerate, shoulders overlapping

    # 1. Shoulder tilt (degrees from horizontal, ~0 is level)
    shoulder_tilt = angle_with_horizontal(l_sh, r_sh)

    # 2. Head drop ratio (vertical distance nose -> shoulder midpoint, normalized)
    #    Positive = nose above shoulders. Gets smaller as you slouch.
    head_drop_ratio = (sh_mid[1] - nose[1]) / sh_width

    # 3. Forward head ratio (uses ears if available, falls back to nose)
    #    Measures how far forward the head is relative to shoulder line.
    if l_ear_c > CONFIDENCE_THRESHOLD and r_ear_c > CONFIDENCE_THRESHOLD:
        ear_mid = midpoint(l_ear, r_ear)
        forward_head_ratio = (ear_mid[1] - sh_mid[1]) / sh_width
        head_tilt = angle_with_horizontal(l_ear, r_ear)
    elif l_ear_c > CONFIDENCE_THRESHOLD:
        forward_head_ratio = (l_ear[1] - sh_mid[1]) / sh_width
        head_tilt = 0.0
    elif r_ear_c > CONFIDENCE_THRESHOLD:
        forward_head_ratio = (r_ear[1] - sh_mid[1]) / sh_width
        head_tilt = 0.0
    else:
        # No ears visible, use nose vertical position as fallback
        forward_head_ratio = (nose[1] - sh_mid[1]) / sh_width
        head_tilt = 0.0

    # 4. Shoulder width raw (proxy for distance to screen)
    return {
        "shoulder_width": sh_width,
        "shoulder_tilt": shoulder_tilt,
        "head_drop_ratio": head_drop_ratio,
        "forward_head_ratio": forward_head_ratio,
        "head_tilt": head_tilt,
    }


class PostureMonitor:
    """
    Handles baseline calibration, smoothing, and deviation detection.

    Usage:
        monitor = PostureMonitor()

        # During calibration phase, call repeatedly:
        monitor.add_calibration_sample(features)

        # When ready:
        monitor.finish_calibration()

        # During monitoring phase:
        status = monitor.evaluate(features)
        # status = {"overall": "good"/"bad", "details": {...}}
    """

    def __init__(self, smoothing_window=12):
        self.smoothing_window = smoothing_window
        self.calibration_samples = []
        self.baseline = None
        self.baseline_variance = None  # Track natural variation during calibration
        self.history = deque(maxlen=smoothing_window)

        # Flexible multi-tier thresholds for each metric
        # Each metric has: warning_threshold, alert_threshold
        # warning: minor deviation, alert: significant deviation (flags as bad)
        # These are MULTIPLIERS of the observed calibration variance
        self.threshold_multipliers = {
            "shoulder_width": {"warning": 3.5, "alert": 5.0},        # 1.5-3x std dev
            "shoulder_tilt": {"warning": 2.5, "alert": 3.5},         # 1.5-2.5x std dev
            "head_drop_ratio": {"warning": 3.5, "alert": 5.0},       # 1.5-3x std dev
            "forward_head_ratio": {"warning": 3.5, "alert": 5.0},    # 1.5-3x std dev
            "head_tilt": {"warning": 2.5, "alert": 3.5},             # 1.5-2.5x std dev
        }

    def add_calibration_sample(self, features):
        if features is not None:
            self.calibration_samples.append(features)

    def finish_calibration(self):
        if len(self.calibration_samples) < 10:
            print(f"WARNING: Only {len(self.calibration_samples)} calibration samples. Try to get at least 30.")

        self.baseline = {}
        self.baseline_variance = {}
        keys = self.calibration_samples[0].keys()
        
        for k in keys:
            vals = np.array([s[k] for s in self.calibration_samples])
            mean_val = np.mean(vals)
            std_val = np.std(vals)
            
            self.baseline[k] = mean_val
            self.baseline_variance[k] = std_val
        
        # Compute dynamic thresholds based on observed variance
        self.thresholds = {}
        for k, multipliers in self.threshold_multipliers.items():
            variance = self.baseline_variance[k]
            # Use max of: (multiplier * observed_variance) or a reasonable minimum
            # This adapts to how much natural movement happens during calibration
            min_threshold = {
                "shoulder_width": 0.08,
                "shoulder_tilt": 5.0,
                "head_drop_ratio": 0.05,
                "forward_head_ratio": 0.05,
                "head_tilt": 3.0,
            }.get(k, 0.05)
            
            warning_threshold = max(variance * multipliers["warning"], min_threshold)
            alert_threshold = max(variance * multipliers["alert"], min_threshold * 2)
            
            self.thresholds[k] = {
                "warning": warning_threshold,
                "alert": alert_threshold,
            }

        print("--- Baseline established ---")
        print(f"Calibration samples: {len(self.calibration_samples)}")
        print("\nMetric baselines & natural variance:")
        for k, v in self.baseline.items():
            var = self.baseline_variance[k]
            thresh = self.thresholds[k]
            print(f"  {k}:")
            print(f"    Baseline: {v:.4f} (±{var:.4f} std dev)")
            print(f"    Thresholds: ⚠ {thresh['warning']:.4f} | 🔴 {thresh['alert']:.4f}")
        print("----------------------------")
        return self.baseline

    def _smooth(self, features):
        """Return rolling average of recent features."""
        self.history.append(features)
        smoothed = {}
        for k in features:
            smoothed[k] = np.mean([f[k] for f in self.history])
        return smoothed

    def evaluate(self, features):
        """
        Compare current (smoothed) features against baseline.
        Returns dict with overall status and per-metric details.
        
        Uses tiered thresholds:
          - "good": all deviations below warning threshold
          - "caution": some deviations above warning but below alert threshold
          - "bad": any deviation exceeds alert threshold
        """
        if self.baseline is None:
            return {"overall": "not_calibrated", "details": {}}
        if features is None:
            return {"overall": "no_pose", "details": {}}

        smoothed = self._smooth(features)
        details = {}
        overall_status = "good"
        caution_count = 0
        alert_count = 0

        for k, thresholds in self.thresholds.items():
            baseline_val = self.baseline[k]
            current_val = smoothed[k]

            if k == "shoulder_width":
                # Proportional deviation
                if baseline_val > 0:
                    deviation = abs(current_val - baseline_val) / baseline_val
                else:
                    deviation = 0
            elif k in ("shoulder_tilt", "head_tilt"):
                # Absolute angle deviation
                deviation = abs(current_val - baseline_val)
            else:
                # Absolute deviation for ratios
                deviation = abs(current_val - baseline_val)

            # Determine severity level
            warning_threshold = thresholds["warning"]
            alert_threshold = thresholds["alert"]
            
            if deviation > alert_threshold:
                metric_status = "alert"
                alert_count += 1
                overall_status = "bad"
            elif deviation > warning_threshold:
                metric_status = "caution"
                caution_count += 1
                if overall_status == "good":
                    overall_status = "caution"
            else:
                metric_status = "good"

            details[k] = {
                "baseline": baseline_val,
                "current": current_val,
                "deviation": deviation,
                "warning_threshold": warning_threshold,
                "alert_threshold": alert_threshold,
                "status": metric_status
            }

        return {
            "overall": overall_status,
            "details": details,
            "metrics_in_caution": caution_count,
            "metrics_in_alert": alert_count,
        }


class PostureScoreTracker:
    """
    Tracks posture quality over an entire session.

    Records every evaluation with a timestamp, then computes:
      - overall_score:  % of session spent in good posture
      - rolling_score:  % of the last `rolling_window` seconds in good posture
      - streak:         how many consecutive seconds in current state
      - worst_metric:   which metric triggered "bad" most often

    Call save_report() at the end to dump a CSV timeline.
    """

    def __init__(self, rolling_window=60):
        self.rolling_window = rolling_window  # seconds
        self.records = []       # list of (timestamp, "good"/"caution"/"bad", details_dict)
        self.session_start = None
        self.streak_state = None
        self.streak_start = None
        self.metric_alert_counts = {}  # tracks "alert" level issues
        self.metric_caution_counts = {}  # tracks "caution" level issues

    def record(self, status):
        """Call this every frame with the output of PostureMonitor.evaluate()."""
        if status["overall"] in ("not_calibrated", "no_pose"):
            return

        now = time.time()
        if self.session_start is None:
            self.session_start = now
            self.streak_state = status["overall"]
            self.streak_start = now

        state = status["overall"]
        self.records.append((now, state, status["details"]))

        # Track streak
        if state != self.streak_state:
            self.streak_state = state
            self.streak_start = now

        # Track which metrics cause the most problems (both caution and alert)
        for name, info in status["details"].items():
            if info["status"] == "alert":
                self.metric_alert_counts[name] = self.metric_alert_counts.get(name, 0) + 1
            elif info["status"] == "caution":
                self.metric_caution_counts[name] = self.metric_caution_counts.get(name, 0) + 1

    @property
    def overall_score(self):
        """
        Percentage of total recorded frames that were 'good'.
        Caution frames count as 50% credit.
        Bad frames count as 0%.
        """
        if not self.records:
            return 0.0
        good = sum(1 for _, s, _ in self.records if s == "good")
        caution = sum(1 for _, s, _ in self.records if s == "caution")
        score = (good + caution * 0.5) / len(self.records)
        return score * 100

    @property
    def rolling_score(self):
        """
        Percentage of frames in the last `rolling_window` seconds that were 'good'.
        Caution frames count as 50% credit.
        """
        if not self.records:
            return 0.0
        cutoff = time.time() - self.rolling_window
        recent = [(t, s) for t, s, _ in self.records if t >= cutoff]
        if not recent:
            return 0.0
        good = sum(1 for _, s in recent if s == "good")
        caution = sum(1 for _, s in recent if s == "caution")
        score = (good + caution * 0.5) / len(recent)
        return score * 100

    @property
    def streak_seconds(self):
        """How many seconds the user has been in their current state."""
        if self.streak_start is None:
            return 0.0
        return time.time() - self.streak_start

    @property
    def session_duration(self):
        """Total session length in seconds."""
        if self.session_start is None:
            return 0.0
        return time.time() - self.session_start

    @property
    def worst_metric(self):
        """The metric that triggered issues (alert or caution) most often, or None."""
        # Combine alert and caution counts (alert counts double)
        combined_counts = {}
        for name, count in self.metric_alert_counts.items():
            combined_counts[name] = combined_counts.get(name, 0) + count * 2
        for name, count in self.metric_caution_counts.items():
            combined_counts[name] = combined_counts.get(name, 0) + count
        
        if not combined_counts:
            return None
        return max(combined_counts, key=combined_counts.get)

    def get_summary(self):
        """Return a printable session summary dict."""
        duration = self.session_duration
        mins, secs = divmod(int(duration), 60)
        return {
            "session_duration": f"{mins}m {secs}s",
            "overall_score": f"{self.overall_score:.1f}%",
            "rolling_score": f"{self.rolling_score:.1f}%",
            "total_frames": len(self.records),
            "worst_metric": self.worst_metric or "none",
            "metric_alert_counts": dict(self.metric_alert_counts),
            "metric_caution_counts": dict(self.metric_caution_counts),
        }

    def save_report(self, filepath="posture_report.csv"):
        """Save a timestamped CSV of the session for later analysis."""
        if not self.records:
            print("No data to save.")
            return

        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            # Header
            detail_keys = list(self.records[0][2].keys())
            header = ["elapsed_seconds", "status"]
            for k in detail_keys:
                header += [f"{k}_current", f"{k}_deviation", f"{k}_status"]
            writer.writerow(header)

            for t, state, details in self.records:
                elapsed = t - self.session_start
                row = [f"{elapsed:.2f}", state]
                for k in detail_keys:
                    info = details[k]
                    row += [
                        f"{info['current']:.4f}",
                        f"{info['deviation']:.4f}",
                        info["status"]
                    ]
                writer.writerow(row)

        print(f"Report saved to {filepath} ({len(self.records)} rows)")

    def print_threshold_info(self):
        """Display current threshold configuration."""
        print("\n╔═══════════════════════════════════════════════════════════╗")
        print("║         CURRENT POSTURE THRESHOLD CONFIGURATION         ║")
        print("╠═══════════════════════════════════════════════════════════╣")
        
        for metric, thresholds in self.thresholds.items():
            warning = thresholds["warning"]
            alert = thresholds["alert"]
            print(f"║ {metric:30} │ ⚠ {warning:6.2f} │ 🔴 {alert:6.2f}   ║")
        
        print("╠═══════════════════════════════════════════════════════════╣")
        print("║ Legend: ⚠ = Caution threshold | 🔴 = Alert threshold    ║")
        print("║ Adjust these values in __init__() to fine-tune sensitivity║")
        print("╚═══════════════════════════════════════════════════════════╝\n")