import type { Metadata } from 'next';

import { DiscoverExplorer } from '@/features/conversations/components/discover-explorer';

export const metadata: Metadata = { title: 'Discover' };

export default function DiscoverPage() {
  return <DiscoverExplorer />;
}
