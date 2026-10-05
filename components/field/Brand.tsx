// علامة المنصة: رمز محايد بألوان الهوية (بلا شعار جهة).

/** رمز التحضير: مربع بتدرّج التيل وعلامة صح، مع نقطة برتقالية من الهوية */
export function PlatformLogo({ height = 40, variant = 'color', className = '' }: { height?: number; variant?: 'color' | 'light'; className?: string }) {
  const light = variant === 'light';
  return (
    <svg
      width={height} height={height} viewBox="0 0 48 48" role="img" aria-label="منصة التحضير"
      className={`shrink-0 ${className}`} style={{ height, width: height }}
    >
      <defs>
        <linearGradient id="pl-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0d9eae" />
          <stop offset="1" stopColor="#0a4f59" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill={light ? 'rgba(255,255,255,0.14)' : 'url(#pl-g)'}
        stroke={light ? 'rgba(255,255,255,0.35)' : 'none'} strokeWidth="1" />
      <path d="M14 25.5l7 7L34.5 17" fill="none" stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="37" cy="11" r="4" fill="#e07820" />
    </svg>
  );
}

export function FieldFooter({ light = false }: { light?: boolean }) {
  return (
    <footer className={`py-6 text-center text-xs ${light ? 'text-white/70' : 'text-fd-muted'}`}>
      منصة التحضير الميداني — جمعية رواسم
    </footer>
  );
}
