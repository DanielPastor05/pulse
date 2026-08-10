import { createDirectSchema } from '@/features/conversations/validators';
import { requireUser } from '@/server/auth';
import { json, parseBody, route } from '@/server/http';
import { rateLimit, rateLimits } from '@/server/rate-limit';
import {
  findOrCreateDirectConversation,
  getConversationDetail,
} from '@/server/repositories/conversation.repository';

export const dynamic = 'force-dynamic';

export const POST = route(async (request) => {
  const user = await requireUser();
  await rateLimit(`direct:${user.id}`, rateLimits.mutate);
  const { userId } = await parseBody(request, createDirectSchema);

  const conversationId = await findOrCreateDirectConversation(user.id, userId);
  return json(await getConversationDetail(conversationId, user.id), { status: 201 });
});
