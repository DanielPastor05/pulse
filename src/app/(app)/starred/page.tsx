import type { Metadata } from 'next';

import { StarredMessages } from '@/features/messages/components/starred-messages';

export const metadata: Metadata = { title: 'Starred' };

export default function StarredPage() {
  return <StarredMessages />;
}
