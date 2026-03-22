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
    
    def connect(self):
        """Establish Socket.IO connection."""
        try:
            self.sio.connect(self.socket_url, wait_timeout=5)
        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            return False
        return True

    def emit_posture_update(self, data):
        """Broadcast posture inference results to other Socket.IO clients."""
        if not self.sio.connected:
            return

        try:
            self.sio.emit('posture-data', data)
        except Exception as e:
            logger.warning(f"Failed to emit posture update: {e}")

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
    
    def process_frames(self):
        """
        Worker loop: dequeue frames, run inference, apply throttling.
        Call this in a thread or main loop.
        """
        iterations = 0
        while not self.stop_requested.is_set():
            iterations += 1
            
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
                
                # Callback for consumer (e.g., monitoring, alerts)
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
