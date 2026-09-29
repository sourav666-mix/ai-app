// src/lib/media.js
// getUserMedia, frame capture, blob (~80 lines) [Batch 2]
// ═══════════════════════════════════════════════════════════════
//  Camera primitives — used by the useCamera hook & CameraModal.
// ═══════════════════════════════════════════════════════════════

export function isCameraSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function listVideoDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

export async function startCameraStream({ facingMode = 'environment', deviceId = null } = {}) {
  const video = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    : { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } };
  return navigator.mediaDevices.getUserMedia({ audio: false, video });
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Attach a MediaStream to a <video> element and wait until it plays. */
export async function attachStreamToVideo(videoEl, stream) {
  videoEl.srcObject = stream;
  await new Promise((resolve) => {
    if (videoEl.readyState >= 2) resolve();
    else videoEl.onloadedmetadata = () => resolve();
  });
  await videoEl.play().catch(() => {}); // autoplay policies — muted+playsInline usually fine
}

/**
 * Grab the current video frame as a JPEG data URL.
 * Photos are captured UN-mirrored (standard camera behavior) even when
 * the preview is CSS-mirrored for the front camera.
 */
export function captureFrame(videoEl, { maxDim = 1920, quality = 0.92, type = 'image/jpeg' } = {}) {
  if (!videoEl || !videoEl.videoWidth) throw new Error('Camera is not ready yet.');
  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}

export function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/data:(.*?)(;|$)/)?.[1] || 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}