import type { Metadata } from 'next';

import { DiscoverExplorer } from '@/features/conversations/components/discover-explorer';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.nav.discover };
}

export default function DiscoverPage() {
  return <DiscoverExplorer />;
}
