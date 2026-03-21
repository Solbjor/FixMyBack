/**
 * Test Frame Emitter - sends dummy frames to the relay
 * Run alongside: node server.js
 */

const io = require('socket.io-client');

// Minimal 1x1 JPEG as base64 (valid JPEG structure)
const VALID_JPEG_B64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

const socket = io('http://localhost:4000');

socket.on('connect', () => {
    console.log('[EMITTER] Connected to relay');
    
    let frameCount = 0;
    const interval = setInterval(() => {
        // Send valid JPEG base64
        const dataUrl = `data:image/jpeg;base64,${VALID_JPEG_B64}`;
        
        socket.emit('frame', dataUrl);
        frameCount++;
        
        if (frameCount % 30 === 0) {
            console.log(`[EMITTER] Sent ${frameCount} frames`);
        }
    }, 100);  // 10 FPS
    
    socket.on('disconnect', () => {
        clearInterval(interval);
        console.log('[EMITTER] Disconnected');
        process.exit(0);
    });
});

socket.on('connect_error', (err) => {
    console.error('[EMITTER] Connection error:', err);
    process.exit(1);
});

console.log('[EMITTER] Connecting to relay at http://localhost:4000...');
