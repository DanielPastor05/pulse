import type { Metadata } from 'next';

import { ChatWelcome } from '@/features/conversations/components/chat-welcome';

export const metadata: Metadata = { title: 'Chats' };

export default function ChatIndexPage() {
  return <ChatWelcome />;
}
