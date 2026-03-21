"""
Test script to verify Stream Bridge can connect and ingest frames.
This test mocks inference to avoid TensorFlow/Python 3.14 issues.
"""

import sys
import logging
import time
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Mock functions to avoid TensorFlow dependency
def mock_run_movenet(frame):
    """Mock inference: return dummy 17 keypoints."""
    # Each keypoint: (y, x, confidence)
    return np.random.rand(17, 3)

def mock_compute_features(keypoints):
    """Mock feature extraction: return dummy dict."""
    if keypoints is None:
        return None
    return {
        "shoulder_width": np.random.rand() * 100,
        "shoulder_tilt": np.random.rand() * 45,
        "head_drop_ratio": np.random.rand(),
        "forward_head_ratio": np.random.rand(),
        "head_tilt": np.random.rand() * 30,
    }

def on_inference_callback(frame, keypoints, features):
    """Log inference results."""
    if features:
        logger.info(f"✓ Inferred: {list(features.keys())}")

# Now test the bridge
def test_stream_bridge():
    from stream_bridge import StreamBridge
    
    # Typical local IP or localhost
    socket_url = "http://localhost:4000"
    
    logger.info(f"Testing Stream Bridge with {socket_url}")
    
    bridge = StreamBridge(
        socket_url=socket_url,
        run_movenet_fn=mock_run_movenet,
        compute_features_fn=mock_compute_features,
        post_inference_cb=on_inference_callback,
    )
    
    logger.info("Connecting...")
    if not bridge.connect():
        logger.error("Failed to connect!")
        return False
    
    logger.info("✓ Connected. Processing frames for 10 seconds...")
    
    # Run for a fixed duration
    start = time.time()
    while time.time() - start < 10:
        try:
            bridge.process_frames()
        except KeyboardInterrupt:
            break
    
    bridge.stop()
    logger.info("✓ Test complete")
    return True

if __name__ == "__main__":
    success = test_stream_bridge()
    sys.exit(0 if success else 1)
