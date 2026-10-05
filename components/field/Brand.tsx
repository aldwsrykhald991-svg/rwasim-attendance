// تذييل المنصة — نص فقط بلا شعار.
export function FieldFooter({ light = false }: { light?: boolean }) {
  return (
    <footer className={`py-6 text-center text-xs ${light ? 'text-white/70' : 'text-fd-muted'}`}>
      منصة التحضير الميداني · بواسطة رواسم
    </footer>
  );
}
