import { Eraser } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui';

type SignaturePadProps = {
  onChange: (dataUrl: string | null) => void;
  label?: string;
};

/**
 * Signature au doigt ou à la souris (événements pointeur). L'image exportée est en PNG
 * sur fond blanc, lisible dans le PDF quel que soit le thème de l'écran.
 */
export function SignaturePad({ onChange, label = 'Signature du client' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Taille réelle du canvas = taille affichée × densité d'écran : trait net sur mobile.
  // Un redimensionnement (rotation, barre d'adresse, clavier) conserve le tracé.
  useEffect(() => {
    const canvas = canvasRef.current!;
    let size = { width: 0, height: 0 };
    const fit = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height || (width === size.width && height === size.height)) return;
      const ratio = window.devicePixelRatio || 1;
      const previous = size.width ? document.createElement('canvas') : null;
      if (previous) {
        previous.width = canvas.width;
        previous.height = canvas.height;
        previous.getContext('2d')!.drawImage(canvas, 0, 0);
      }
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      if (previous) ctx.drawImage(previous, 0, 0, size.width, size.height);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0b1b33';
      size = { width, height };
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (!empty) onChange(canvasRef.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-label text-ink">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={empty}>
          <Eraser aria-hidden />
          Effacer
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={empty ? `${label} : zone de signature vide` : `${label} : signature tracée`}
        className="h-44 w-full touch-none rounded-lg border-2 border-dashed border-field-border bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
      <p className="text-caption text-ink-muted">Le client signe avec le doigt dans le cadre.</p>
    </div>
  );
}
