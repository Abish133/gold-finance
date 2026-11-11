import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImageUp, Trash2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { Button, PageHeader } from '@/components/ui';
import { useSettings } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { ExitButton } from '@/features/loans/desk';

/** Appearance: background picture behind every screen (desktop: Background Image). */
export default function AppearancePage() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const file = useRef(null);
  const [busy, setBusy] = useState(false);
  const bg = settings?.BACKGROUND_IMAGE;
  const send = async (f) => {
    setBusy(true);
    try {
      if (f) await api.upload('/desk/background', f); else await api.post('/desk/background');
      toast.success(f ? 'Background image set' : 'Background removed');
      qc.invalidateQueries({ queryKey: ['/admin/settings'] });
    } catch (e) { toast.error(e.message); }
    setBusy(false);
    if (file.current) file.current.value = '';
  };
  return (
    <div className="animate-rise space-y-3">
      <PageHeader icon={Palette} title="Appearance" subtitle="Background image shown faintly behind every screen" />
      <div className="card space-y-4 p-4">
        <div className="grid aspect-[16/6] max-w-3xl place-items-center overflow-hidden rounded-md border border-ink-200 bg-ink-50">
          {bg ? <img src={bg} alt="Background" className="size-full object-cover" /> : <p className="text-sm text-ink-500">No background image</p>}
        </div>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
        <div className="flex gap-2">
          <Button icon={ImageUp} loading={busy} onClick={() => file.current?.click()}>Choose image</Button>
          {bg && <Button variant="soft-danger" icon={Trash2} onClick={() => send(null)}>Remove</Button>}
          <span className="ml-auto"><ExitButton /></span>
        </div>
        <p className="text-xs text-ink-500">Use a light picture (logo, shop photo). It is shown very faintly so text stays easy to read. Applies to all branches.</p>
      </div>
    </div>
  );
}
