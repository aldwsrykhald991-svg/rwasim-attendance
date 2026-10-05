// هوية منصة التحضير: شعار جمعية رواسم.
/* eslint-disable @next/next/no-img-element */
export function PlatformLogo({ height = 40, variant = 'color', className = '' }: { height?: number; variant?: 'color' | 'light'; className?: string }) {
  return (
    <img
      src="/logo.jpg"
      alt="شعار جمعية رواسم"
      height={height}
      className={`shrink-0 rounded-xl object-contain ${variant === 'light' ? 'bg-white p-0.5' : ''} ${className}`}
      style={{ height, width: 'auto' }}
    />
  );
}

export function FieldFooter({ light = false }: { light?: boolean }) {
  return (
    <footer className={`py-6 text-center text-xs ${light ? 'text-white/70' : 'text-fd-muted'}`}>
      منصة التحضير الميداني — جمعية رواسم
    </footer>
  );
}
