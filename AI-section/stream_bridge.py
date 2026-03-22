"""
Stream Bridge — Real-time pose inference from Socket.IO frame stream

Run with: python main.py --stream --socket http://192.168.1.192:4000
  (adjust socket URL to match your LAN IP)

Connects to the webcam relay server, subscribes to 'frame' events,
decodes base64 JPEG frames, runs MoveNet inference, and logs posture
status and statistics.
"""

import base64
import io
import time
import logging
import numpy as np
from threading import Thread, Event
from collections import deque
from socketio import Client

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

logger = logging.getLogger(__name__)


class StreamBridge:
    """
    Ingests live frames over Socket.IO, runs inference, handles backpressure.
    """
    
    def __init__(self, socket_url, run_movenet_fn, compute_features_fn, post_inference_cb=None):
        """
        Args:
            socket_url: e.g., 'http://192.168.1.192:4000'
            run_movenet_fn: function to run inference on BGR frame
            compute_features_fn: function to extract posture features from keypoints
            post_inference_cb: optional callback(frame, keypoints, features) after inference
        """
        self.socket_url = socket_url
        self.run_movenet = run_movenet_fn
        self.compute_features = compute_features_fn
        self.post_inference_cb = post_inference_cb or (lambda *args: None)
        
        self.sio = Client()
        self.connected = Event()
        self.stop_requested = Event()
        
        # Backpressure & frame throttling
        self.frame_queue = deque(maxlen=1)  # Drop oldest if new frame arrives
        self.last_process_time = time.time()
        self.target_fps = 30  # Process max 30 FPS (wider margin than send rate)
        self.frame_drop_count = 0
        
        # Statistics
        self.frames_received = 0
        self.frames_received_total = 0
        self.frames_processed = 0
        self.frames_processed_total = 0
        self.frames_dropped = 0
        self.frames_dropped_total = 0
        self.inference_times = deque(maxlen=100)
        self.last_log_time = time.time()
        
        # Calibration & baseline state
        self.calibration_mode = False
        self.calibration_start_time = None
        self.calibration_duration = 15  # seconds (collect ~100 samples at 7 FPS avg)
        self.baseline_samples = []  # List of feature dicts
        self.baseline_samples_target = 100  # Collect 100 samples for robust baseline
        self.baseline_features = None  # Computed mean feature vector
        
        # Posture change detection
        self.last_alert_time = 0
        self.alert_cooldown = 10  # Minimum seconds between alerts
        self.posture_change_threshold = 0.25  # Normalized distance threshold
        
        # Setup event handlers
        self._setup_socket()
    
    def _setup_socket(self):
        """Register Socket.IO event handlers."""
        
        @self.sio.event
        def connect():
            logger.info(f"✓ Connected to {self.socket_url}")
            self.connected.set()
        
        @self.sio.event
        def disconnect():
            logger.warning("✗ Disconnected from Socket.IO server")
            self.connected.clear()
        
        @self.sio.on('frame')
        def on_frame(data):
            """Receive frame from server (base64 data URL)."""
            self.frames_received += 1
            self.frames_received_total += 1
            
            # Naive backpressure: drop if queue already has frame
            if len(self.frame_queue) > 0:
                self.frames_dropped += 1
                self.frames_dropped_total += 1
            
            self.frame_queue.append(data)
        
        @self.sio.on('calibrate-start')
        def on_calibrate_start():
            """Start baseline calibration for 10 seconds."""
            logger.info(f"🔄 [CALIBRATION] Starting baseline collection ({self.calibration_duration}s)...")
            self.calibration_mode = True
            self.calibration_start_time = time.time()
            self.baseline_samples = []
            self.baseline_features = None

        @self.sio.on('session-stop')
        def on_session_stop():
            """Stop monitoring when session ends."""
            logger.info("🛑 [SESSION] Stop signal received. Shutting down...")
            self.stop()
    
    def connect(self):
        """Establish Socket.IO connection."""
        try:
            self.sio.connect(self.socket_url, wait_timeout=5)
        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            return False
        return True
    
    def _decode_frame(self, data_url: str) -> np.ndarray:
        """
        Decode base64 JPEG data URL to BGR numpy array.
        
        Expected format: 'data:image/jpeg;base64,<base64_string>'
        """
        if not HAS_CV2:
            # Return None if cv2 not available (for testing purposes)
            return None
            
        try:
            # Extract base64 part
            if ',' in data_url:
                b64_str = data_url.split(',', 1)[1]
            else:
                b64_str = data_url
            
            # Decode
            jpg_bytes = base64.b64decode(b64_str)
            frame = cv2.imdecode(np.frombuffer(jpg_bytes, np.uint8), cv2.IMREAD_COLOR)
            
            if frame is None:
                logger.warning("Failed to decode frame (invalid JPEG)")
                return None
            
            return frame
        except Exception as e:
            logger.warning(f"Decode error: {e}")
            return None
    
    def _finalize_baseline(self):
        """Compute mean baseline from collected samples."""
        valid_samples = [s for s in self.baseline_samples if isinstance(s, dict)]
        if not valid_samples:
            logger.warning("No valid baseline samples collected.")
            self.sio.emit('calibration-failed', {
                'message': 'Calibration failed: no reliable pose samples detected. Ensure your upper body is visible and retry.'
            })
            return

        if len(valid_samples) < 10:
            logger.warning(f"Too few valid baseline samples collected: {len(valid_samples)}")
            self.sio.emit('calibration-failed', {
                'message': f'Calibration failed: only {len(valid_samples)} valid samples collected. Keep still and retry.'
            })
            return
        
        # Average all feature vectors
        baseline_dict = {}
        for key in valid_samples[0].keys():
            values = [s[key] for s in valid_samples]
            baseline_dict[key] = float(np.mean(values))
        
        self.baseline_features = baseline_dict
        logger.info(
            f"✅ [CALIBRATION] Baseline established from {len(valid_samples)}/{self.baseline_samples_target} samples\n"
            f"   Baseline: {baseline_dict}"
        )
        
        # Emit calibration-complete event
        self.sio.emit('calibration-complete', {
            'message': f'Baseline established from {len(valid_samples)} samples (target: {self.baseline_samples_target})'
        })
    
    def _detect_posture_change(self, features: dict) -> bool:
        """
        Compare current features to baseline.
        Return True if significant change detected.
        """
        if self.baseline_features is None:
            return False
        
        # Compute weighted distance from baseline
        max_distance = 0.0
        for key in self.baseline_features:
            if key in features:
                baseline_val = self.baseline_features[key]
                current_val = features[key]
                
                # Normalize by expected range (~180 deg for angles, 1.0 for normalized metrics)
                if 'angle' in key.lower():
                    normalized_dist = abs(current_val - baseline_val) / 180.0
                else:
                    normalized_dist = abs(current_val - baseline_val)
                
                max_distance = max(max_distance, normalized_dist)
        
        return max_distance > self.posture_change_threshold
    
    def _send_alert(self, alert_type: str, message: str, severity: str = 'medium'):
        """Rate-limited posture alert emission."""
        now = time.time()
        if now - self.last_alert_time < self.alert_cooldown:
            return  # Too soon, ignore
        
        self.last_alert_time = now
        logger.warning(f"🚨 [ALERT] {alert_type}: {message} (severity: {severity})")
        
        # Emit via Socket.IO so frontend receives it
        self.sio.emit('posture-alert', {
            'type': alert_type,
            'message': message,
            'severity': severity,
            'timestamp': now
        })
    
    def process_frames(self):
        """
        Worker loop: dequeue frames, run inference, handle calibration & detection.
        Call this in a thread or main loop.
        """
        iterations = 0
        while not self.stop_requested.is_set():
            iterations += 1
            
            # Check if calibration period has ended
            if self.calibration_mode and self.calibration_start_time:
                elapsed = time.time() - self.calibration_start_time
                if elapsed > self.calibration_duration:
                    logger.info(f"⏱️  [CALIBRATION] {self.calibration_duration}s period complete. Finalizing baseline...")
                    self._finalize_baseline()
                    self.calibration_mode = False
            
            # Throttle: only process if enough time has elapsed
            now = time.time()
            time_since_last = now - self.last_process_time
            min_interval = 1.0 / self.target_fps
            
            if time_since_last < min_interval:
                time.sleep(0.001)  # Brief sleep to avoid busy-wait
                continue
            
            # Try to get next frame
            if len(self.frame_queue) == 0:
                time.sleep(0.001)
                continue
            
            frame_data = self.frame_queue.popleft()
            
            # Decode
            frame = self._decode_frame(frame_data)
            if frame is None:
                # If no cv2 available (testing), just pass mock frame
                frame = np.zeros((100, 100, 3), dtype=np.uint8)
            
            # Run inference
            t0 = time.time()
            try:
                keypoints = self.run_movenet(frame)
                features = self.compute_features(keypoints)
                
                infer_time = time.time() - t0
                self.inference_times.append(infer_time)
                
                # Handle calibration: collect samples
                if self.calibration_mode:
                    if isinstance(features, dict):
                        self.baseline_samples.append(features)
                        if len(self.baseline_samples) % 10 == 0:
                            logger.info(f"   📊 Baseline progress: {len(self.baseline_samples)}/{self.baseline_samples_target} samples")
                
                # Handle detection: check for posture changes (only after calibration)
                elif self.baseline_features is not None:
                    if self._detect_posture_change(features):
                        # Extract primary alert metrics
                        primary_msg = "Poor posture detected"
                        if features.get('neck_angle', 0) > 30:
                            primary_msg = "⚠️ Neck angle too high"
                        elif features.get('shoulder_tilt', 0) > 20:
                            primary_msg = "⚠️ Shoulder misaligned"
                        
                        self._send_alert('posture_change', primary_msg, 'medium')
                
                # Callback for consumer
                self.post_inference_cb(frame, keypoints, features)
                
                self.frames_processed += 1
                self.frames_processed_total += 1
                self.last_process_time = time.time()
                
            except Exception as e:
                logger.error(f"Inference error: {e}")
            
            # Log stats periodically
            self._log_stats()
    
    def _log_stats(self):
        """Log throughput and performance metrics."""
        now = time.time()
        if now - self.last_log_time < 5.0:  # Log every 5 seconds
            return
        
        recv_rate = self.frames_received / (now - self.last_log_time + 0.001)
        proc_rate = self.frames_processed / (now - self.last_log_time + 0.001)
        
        avg_infer_ms = np.mean(self.inference_times) * 1000 if self.inference_times else 0
        
        logger.info(
            f"[STATS] Recv: {self.frames_received:5d} "
            f"| Proc: {self.frames_processed:5d} "
            f"| Drop: {self.frames_dropped:4d} "
            f"| Rate: {recv_rate:.1f} rx/s, {proc_rate:.1f} proc/s "
            f"| Infer: {avg_infer_ms:.1f}ms"
        )
        
        self.last_log_time = now
        self.frames_received = 0
        self.frames_processed = 0
        self.frames_dropped = 0
    
    def run_async(self):
        """
        Start frame processing in a background thread.
        Call stop() to cleanly shut down.
        """
        self.stop_requested.clear()
        thread = Thread(target=self.process_frames, daemon=False)
        thread.start()
        return thread
    
    def stop(self):
        """Signal the worker thread to stop."""
        self.stop_requested.set()
        if self.sio.connected:
            self.sio.disconnect()
        logger.info("Stream bridge stopped")
