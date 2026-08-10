import { redirect } from 'next/navigation';

import { getAuthUser } from '@/server/auth';

export const dynamic = 'force-dynamic';

export default async function IndexPage() {
  const user = await getAuthUser();
  redirect(user ? '/chat' : '/login');
}
