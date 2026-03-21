"""
Quick test: connect to stream, process 5 seconds of frames, print stats.
"""

import sys
import time
import logging
import numpy as np
from threading import Thread

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(name)s — %(message)s',
    datefmt='%H:%M:%S'
)

def mock_run_movenet(frame):
    return np.random.rand(17, 3)

def mock_compute_features(keypoints):
    if keypoints is None:
        return None
    return {"metric": np.random.rand()}

print("=" * 60)
print("STREAM BRIDGE CONNECTIVITY TEST")
print("=" * 60)

from stream_bridge import StreamBridge

bridge = StreamBridge(
    socket_url="http://localhost:4000",
    run_movenet_fn=mock_run_movenet,
    compute_features_fn=mock_compute_features,
)

print("\n[TEST] Connecting to http://localhost:4000...")
if not bridge.connect():
    print("[FAIL] Connection rejected")
    sys.exit(1)

print("[OK] Connected")
print("[TEST] Running for 5 seconds...\n")

# Run processing in background thread
thread = bridge.run_async()
time.sleep(5)
bridge.stop()
thread.join(timeout=2)

print("\n" + "=" * 60)
print(f"[RESULTS]")
print(f"  Frames received:  {bridge.frames_received_total}")
print(f"  Frames processed: {bridge.frames_processed_total}")
print(f"  Frames dropped:   {bridge.frames_dropped_total}")
print(f"  Status: {'✓ PASS' if bridge.frames_processed_total > 0 else '✗ FAIL'}")
print("=" * 60)

sys.exit(0 if bridge.frames_processed_total > 0 else 1)
