// تذييل المنصة — بلا شعار ولا اسم جهة.
export function FieldFooter({ light = false }: { light?: boolean }) {
  return (
    <footer className={`py-6 text-center text-xs ${light ? 'text-white/70' : 'text-fd-muted'}`}>
      منصة التحضير الميداني
    </footer>
  );
}
