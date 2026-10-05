import { NextResponse } from 'next/server';
import { clearFieldCookie } from '@/lib/field/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearFieldCookie(res);
  return res;
}
