import type { Metadata } from 'next';

import { StarredMessages } from '@/features/messages/components/starred-messages';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.message.starred };
}

export default function StarredPage() {
  return <StarredMessages />;
}
