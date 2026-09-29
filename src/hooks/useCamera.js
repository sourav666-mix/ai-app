// src/hooks/useCamera.js
// Camera lifecycle + capture (~95 lines) [Batch 2]
// ═══════════════════════════════════════════════════════════════
//  useCamera — React wrapper over lib/media.js
//  Attach videoRef to a <video autoPlay playsInline muted> element.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isCameraSupported,
  listVideoDevices,
  startCameraStream,
  stopStream,
  attachStreamToVideo,
  captureFrame,
} from '../lib/media';

export function useCamera({ initialFacing = 'environment' } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  const [facing, setFacing] = useState(initialFacing);
  const [deviceCount, setDeviceCount] = useState(0);
  const supported = isCameraSupported();

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  const start = useCallback(
    async ({ deviceId = null, mode } = {}) => {
      if (!supported) {
        setError({ message: 'Camera is not supported in this browser.' });
        return false;
      }
      const useFacing = mode || facing;
      setIsStarting(true);
      setError(null);
      stopStream(streamRef.current); // restart clean on re-use
      try {
        const stream = await startCameraStream({ facingMode: useFacing, deviceId });
        streamRef.current = stream;
        if (videoRef.current) await attachStreamToVideo(videoRef.current, stream);
        setIsActive(true);
        setFacing(useFacing);
        listVideoDevices()
          .then((d) => setDeviceCount(d.length))
          .catch(() => {});
        return true;
      } catch (err) {
        let message = err?.message || 'Could not start the camera.';
        if (err?.name === 'NotAllowedError') message = 'Camera permission denied. Allow access and try again.';
        else if (err?.name === 'NotFoundError') message = 'No camera found on this device.';
        else if (err?.name === 'NotReadableError') message = 'Camera is in use by another app.';
        setError({ message });
        setIsActive(false);
        return false;
      } finally {
        setIsStarting(false);
      }
    },
    [facing, supported]
  );

  const switchCamera = useCallback(() => {
    const next = facing === 'environment' ? 'user' : 'environment';
    return start({ mode: next });
  }, [facing, start]);

  /** Returns a JPEG data URL of the current frame. */
  const capture = useCallback((opts) => {
    if (!streamRef.current) throw new Error('Camera is not active.');
    return captureFrame(videoRef.current, opts);
  }, []);

  // Always release the camera on unmount
  useEffect(() => () => stop(), [stop]);

  return { videoRef, isActive, isStarting, error, facing, deviceCount, supported, start, stop, capture, switchCamera };
}