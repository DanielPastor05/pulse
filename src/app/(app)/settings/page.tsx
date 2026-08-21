import type { Metadata } from 'next';

import { SettingsView } from '@/features/profile/components/settings-view';
import { getMessages } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.title };
}

export default function SettingsPage() {
  return <SettingsView />;
}
