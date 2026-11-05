import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RefreshCw, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './Button';
import { Drawer } from './Drawer';

/** Compress an image file in the browser before upload (fast uploads, small DB). */
export const compressImage = (file, max = 1280, quality = 0.82) =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = Object.assign(document.createElement('canvas'), { width: img.width * scale, height: img.height * scale });
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(new File([b], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })), 'image/jpeg', quality);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });

/** Webcam capture inside a drawer (replaces the desktop app's camera window). */
function CameraDrawer({ open, onClose, onCapture }) {
  const video = useRef(null);
  const [stream, setStream] = useState(null);
  const [facing, setFacing] = useState('environment');

  useEffect(() => {
    if (!open) return undefined;
    let s;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: 1280, height: 720 } })
      .then((st) => { s = st; setStream(st); if (video.current) video.current.srcObject = st; })
      .catch(() => { toast.error('Camera not available. Allow camera permission or upload a photo.'); onClose(); });
    return () => s?.getTracks().forEach((t) => t.stop());
  }, [open, facing, onClose]);

  const snap = () => {
    const v = video.current;
    const canvas = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
    canvas.getContext('2d').drawImage(v, 0, 0);
    canvas.toBlob((b) => { onCapture(new File([b], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })); onClose(); }, 'image/jpeg', 0.85);
  };

  return (
    <Drawer open={open} onClose={onClose} title="Capture photo" icon={Camera} size="lg"
      footer={<><Button variant="outline" icon={RefreshCw} onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>Switch camera</Button>
        <Button variant="gold" icon={Check} onClick={snap} disabled={!stream}>Capture</Button></>}>
      <video ref={video} autoPlay playsInline muted className="aspect-video w-full rounded-2xl bg-ink-900 object-cover" />
    </Drawer>
  );
}

/**
 * Photo picker with upload + live camera.
 * `upload(file) => Promise<path>` performs the actual upload and returns the stored path.
 */
export function ImageCapture({ value, onChange, upload, label = 'Photo', aspect = 'aspect-square', className }) {
  const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState(false);
  const input = useRef(null);

  const handle = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const small = await compressImage(file);
      const path = await upload(small);
      onChange?.(path);
    } catch (e) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <span className="label">{label}</span>
      <div className={`group relative ${aspect} w-full overflow-hidden rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-950`}>
        {value ? <img src={value} alt={label} className="size-full object-cover" /> : (
          <div className="grid size-full place-items-center text-ink-400"><ImagePlus className="size-8" /></div>
        )}
        {busy && <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-semibold dark:bg-ink-900/70">Uploading…</div>}
        <div className="absolute inset-x-2 bottom-2 flex justify-center gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <Button size="sm" variant="outline" icon={ImagePlus} onClick={() => input.current?.click()}>Upload</Button>
          <Button size="sm" variant="outline" icon={Camera} onClick={() => setCam(true)}>Camera</Button>
          {value && <Button size="sm" variant="outline" icon={Trash2} onClick={() => onChange?.(null)} />}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      <CameraDrawer open={cam} onClose={() => setCam(false)} onCapture={handle} />
    </div>
  );
}
