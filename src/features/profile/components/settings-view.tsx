'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bell,
  Check,
  Monitor,
  Moon,
  Palette,
  ShieldBan,
  Sun,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  Volume2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { AccountDangerZone } from '@/features/profile/components/account-danger-zone';
import { updateProfileSchema, type UpdateProfileInput } from '@/features/profile/validators';
import {
  useBlockedUsers,
  useRelationshipActions,
  useRelationships,
  useSetBlocked,
  useUpdateProfile,
} from '@/features/profile/hooks';
import { AccentPicker } from '@/features/profile/components/accent-picker';
import { AvatarPicker } from '@/features/profile/components/avatar-picker';
import { ensureNotificationPermission, playChime } from '@/features/notifications/sound';
import { disablePush, enablePush } from '@/features/notifications/push';
import { useSession } from '@/components/providers/session-provider';
import { LOCALE_COOKIE, LOCALE_LABELS, useT } from '@/i18n/provider';
import type { Locale } from '@prisma/client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <div className="mb-4 space-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-[13px] text-[var(--text-2)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-[var(--radius-card)] p-2.5 transition-colors hover:bg-[var(--surface-sunken)]">
      <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-field)] bg-[var(--surface-sunken)] text-[var(--accent)] [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-[12px] leading-snug text-[var(--text-2)]">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ProfileTab() {
  const me = useSession();
  const update = useUpdateProfile();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: me.displayName,
      username: me.username,
      bio: me.bio ?? '',
      statusText: me.statusText ?? '',
      avatarUrl: me.avatarUrl,
    },
  });

  const t = useT();
  const values = watch();

  return (
    <>
      <form
        onSubmit={handleSubmit((input) => update.mutate(input, { onSuccess: () => reset(input) }))}
        className="space-y-5"
      >
        <Section title={t.settings.profile} description={t.settings.profileHint}>
          <div className="space-y-5">
            <AvatarPicker
              value={values.avatarUrl ?? null}
              name={values.displayName ?? me.displayName}
              onChange={(url) => setValue('avatarUrl', url, { shouldDirty: true })}
              size="lg"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.settings.displayName} htmlFor="displayName" error={errors.displayName?.message}>
                <Input id="displayName" {...register('displayName')} />
              </Field>
              <Field label={t.settings.username} htmlFor="username" error={errors.username?.message}>
                <Input
                  id="username"
                  {...register('username', {
                    setValueAs: (value: string) => value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  })}
                />
              </Field>
            </div>

            <Field label={t.settings.status} htmlFor="statusText" hint={t.settings.statusHint}>
              <Input
                id="statusText"
                placeholder={t.settings.statusPlaceholder}
                {...register('statusText')}
              />
            </Field>

            <Field
              label={t.settings.bio}
              htmlFor="bio"
              hint={`${values.bio?.length ?? 0}/280`}
              error={errors.bio?.message}
            >
              <Textarea id="bio" rows={3} maxLength={280} {...register('bio')} />
            </Field>
          </div>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty} loading={update.isPending}>
            {t.common.saveChanges}
          </Button>
        </div>
      </form>

      {/* Fuera del formulario: sus botones no deben enviar el perfil. */}
      <div className="mt-5">
        <AccountDangerZone />
      </div>
    </>
  );
}

function AppearanceTab() {
  const t = useT();
  const me = useSession();
  const update = useUpdateProfile();
  const { theme, setTheme } = useTheme();

  const options = [
    { id: 'light', icon: Sun, label: t.settings.themeLight },
    { id: 'dark', icon: Moon, label: t.settings.themeDark },
    { id: 'system', icon: Monitor, label: t.settings.themeSystem },
  ] as const;

  return (
    <div className="space-y-5">
      <Section title={t.settings.theme} description={t.settings.themeHint}>
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setTheme(option.id);
                update.mutate({ theme: option.id.toUpperCase() as 'LIGHT' | 'DARK' | 'SYSTEM' });
              }}
              aria-pressed={theme === option.id}
              className={cn(
                'flex flex-col items-center gap-2 rounded-[var(--radius-card)] border p-4 transition-all duration-200',
                theme === option.id
                  ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]'
                  : 'border-[var(--hairline)] hover:border-[var(--hairline-strong)]',
              )}
            >
              <option.icon
                className={cn(
                  'size-5',
                  theme === option.id ? 'text-[var(--accent)]' : 'text-[var(--text-3)]',
                )}
              />
              <span className="text-[13px] font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title={t.settings.accent} description={t.settings.accentHint}>
        <AccentPicker value={me.accent} onChange={(accent) => update.mutate({ accent })} />
      </Section>

      <Section title={t.settings.language} description={t.settings.languageHint}>
        <LanguagePicker />
      </Section>

      <Section title={t.settings.motion} description={t.settings.motionHint}>
        <ToggleRow
          icon={<Palette />}
          title={t.settings.reducedMotion}
          description={t.settings.reducedMotionHint}
          checked={me.reducedMotion}
          onChange={(reducedMotion) => update.mutate({ reducedMotion })}
        />
      </Section>
    </div>
  );
}

function NotificationsTab() {
  const t = useT();
  const me = useSession();
  const update = useUpdateProfile();

  return (
    <Section title={t.settings.notifications} description={t.settings.notificationsHint}>
      <div className="space-y-1">
        <ToggleRow
          icon={<Bell />}
          title={t.settings.onMessage}
          description={t.settings.onMessageHint}
          checked={me.notifications.onMessage}
          onChange={(value) => update.mutate({ notifyOnMessage: value })}
        />
        <ToggleRow
          icon={<UserRound />}
          title={t.settings.onMention}
          description={t.settings.onMentionHint}
          checked={me.notifications.onMention}
          onChange={(value) => update.mutate({ notifyOnMention: value })}
        />
        <ToggleRow
          icon={<Check />}
          title={t.settings.onReaction}
          description={t.settings.onReactionHint}
          checked={me.notifications.onReaction}
          onChange={(value) => update.mutate({ notifyOnReaction: value })}
        />
        <ToggleRow
          icon={<Volume2 />}
          title={t.settings.sound}
          description={t.settings.soundHint}
          checked={me.notifications.sounds}
          onChange={(value) => {
            update.mutate({ notifySounds: value });
            if (value) playChime('incoming');
          }}
        />
        <ToggleRow
          icon={<Monitor />}
          title={t.settings.desktopPush}
          description={t.settings.desktopHint}
          checked={me.notifications.desktopPush}
          onChange={async (value) => {
            if (!value) {
              await disablePush();
              update.mutate({ notifyDesktopPush: false });
              return;
            }

            const result = await enablePush();

            if (result === 'needs-install') {
              // Not a permission problem and not fixable in settings: on iOS
              // Safari exposes no push at all outside the installed app.
              toast.error(t.settings.needsInstall, {
                description: t.settings.needsInstallHint,
              });
              return;
            }
            if (result === 'denied') {
              toast.error(t.settings.permissionDenied, {
                description: t.settings.permissionDeniedHint,
              });
              return;
            }
            if (result === 'unsupported' || result === 'error') {
              // Falls back to the in-page notifications, which still work while
              // the tab is open.
              const granted = await ensureNotificationPermission();
              if (!granted) {
                toast.error(t.settings.permissionDenied, {
                  description: t.settings.permissionDeniedHint,
                });
                return;
              }
              toast.message(t.settings.openOnly, {
                description: t.settings.openOnlyHint,
              });
            }

            update.mutate({ notifyDesktopPush: true });
          }}
        />
      </div>
    </Section>
  );
}

function PeopleTab() {
  const t = useT();
  const { data: relationships, isLoading } = useRelationships();
  const { respond, remove } = useRelationshipActions();
  const { data: blocked } = useBlockedUsers();
  const setBlocked = useSetBlocked();

  const incoming = (relationships ?? []).filter(
    (item) => item.direction === 'incoming' && item.status === 'PENDING',
  );
  const outgoing = (relationships ?? []).filter(
    (item) => item.direction === 'outgoing' && item.status === 'PENDING',
  );
  const friends = (relationships ?? []).filter((item) => item.status === 'ACCEPTED');

  return (
    <div className="space-y-5">
      <Section title={t.settings.friendRequests} description={t.settings.friendRequestsHint}>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : incoming.length === 0 && outgoing.length === 0 ? (
          <EmptyState compact icon={<UserRoundCheck />} title={t.settings.noPending} />
        ) : (
          <ul className="space-y-1.5">
            {incoming.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-2.5"
              >
                <Avatar src={item.user.avatarUrl} name={item.user.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.user.displayName}</p>
                  <p className="truncate text-[11px] text-[var(--text-3)]">@{item.user.username}</p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t.common.decline}
                  onClick={() => respond.mutate({ id: item.id, accept: false })}
                >
                  <X />
                </Button>
                <Button
                  size="icon-sm"
                  aria-label={t.common.accept}
                  onClick={() => respond.mutate({ id: item.id, accept: true })}
                >
                  <Check />
                </Button>
              </li>
            ))}
            {outgoing.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-2.5"
              >
                <Avatar src={item.user.avatarUrl} name={item.user.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.user.displayName}</p>
                  <p className="text-[11px] text-[var(--text-3)]">{t.settings.requestSent}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(item.id)}>
                  {t.common.cancel}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.settings.friends} description={t.settings.friendsHint}>
        {friends.length === 0 ? (
          <EmptyState
            compact
            icon={<UserRoundCheck />}
            title={t.settings.noFriends}
            description={t.settings.noFriendsHint}
          />
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {friends.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/u/${item.user.username}`}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] p-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <Avatar
                    src={item.user.avatarUrl}
                    name={item.user.displayName}
                    size="sm"
                    presence={item.user.presence}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {item.user.displayName}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--text-3)]">
                      @{item.user.username}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.settings.blocked} description={t.settings.blockedHint}>
        {!blocked || blocked.length === 0 ? (
          <EmptyState compact icon={<ShieldBan />} title={t.settings.nobodyBlocked} />
        ) : (
          <ul className="space-y-1.5">
            {blocked.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-2.5"
              >
                <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{user.displayName}</p>
                  <p className="truncate text-[11px] text-[var(--text-3)]">@{user.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBlocked.mutate({ userId: user.id, blocked: false })}
                >
                  <UserRoundX />
                  {t.settings.unblock}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function SettingsView() {
  const t = useT();

  return (
    <div className="panel flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)] shadow-[var(--shadow-raised)]">
      <header className="border-b border-[var(--hairline)] p-5 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">{t.settings.title}</h1>
        <p className="mt-1 text-[13px] text-[var(--text-2)]">
          {t.settings.intro}
        </p>
      </header>

      <div className="scroll-area flex-1 overflow-y-auto p-5 pb-24 lg:pb-5">
        <div className="mx-auto max-w-3xl">
          <Tabs defaultValue="profile">
            <TabsList className="mb-5 flex-wrap">
              <TabsTrigger value="profile">{t.settings.profile}</TabsTrigger>
              <TabsTrigger value="appearance">{t.settings.appearance}</TabsTrigger>
              <TabsTrigger value="notifications">{t.settings.notifications}</TabsTrigger>
              <TabsTrigger value="people">{t.settings.people}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <ProfileTab />
            </TabsContent>
            <TabsContent value="appearance">
              <AppearanceTab />
            </TabsContent>
            <TabsContent value="notifications">
              <NotificationsTab />
            </TabsContent>
            <TabsContent value="people">
              <PeopleTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/**
 * El idioma de la interfaz.
 *
 * Escribe en dos sitios a la vez y no es duplicidad: la fila del usuario es la
 * preferencia —viaja entre dispositivos y sobrevive a borrar los datos del
 * sitio— y la cookie es lo unico que el servidor puede leer para pintar en el
 * idioma correcto las pantallas que existen antes de la sesion, como la de
 * entrar.
 *
 * Recarga al terminar. Es lo mas honesto que se puede hacer aqui: la mitad de
 * los textos vienen del servidor, asi que cambiarlos sin volver a pedirlos
 * dejaria media pantalla en un idioma y media en otro.
 */
function LanguagePicker() {
  const me = useSession();
  const update = useUpdateProfile();
  const [saving, setSaving] = React.useState(false);

  const choose = (locale: Locale) => {
    if (locale === me.locale || saving) return;
    setSaving(true);

    // Un ano de vida y `SameSite=Lax`: no es un dato sensible, pero tampoco
    // tiene por que viajar en peticiones que vengan de otro sitio.
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;

    update.mutate(
      { locale },
      { onSettled: () => window.location.reload() },
    );
  };

  return (
    <div className="flex gap-2">
      {(Object.keys(LOCALE_LABELS) as Locale[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => choose(code)}
          disabled={saving}
          aria-pressed={me.locale === code}
          className={cn(
            'flex-1 rounded-[var(--radius-card)] border px-4 py-3 text-[13px] font-medium',
            'transition-colors duration-150 disabled:opacity-60',
            me.locale === code
              ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-[var(--accent)]'
              : 'border-[var(--hairline)] text-[var(--text-2)] hover:border-[var(--hairline-strong)]',
          )}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
