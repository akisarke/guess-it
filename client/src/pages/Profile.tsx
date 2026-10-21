import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, needsAccount, type ProfileResponse } from '../lib/api';
import { BadgeChip } from '../components/BadgeChip';
import { HackClubFlag } from '../components/HackClubFlag';
import { ProfileEditor } from '../components/ProfileEditor';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { MarkdownBio } from '../components/MarkdownBio';
import type { ProfileUpdate } from '../lib/api';
import { NotLoggedIn } from '../components/NotLoggedIn';
import { StateCard } from '../components/StateCard';
import { EmailVerificationPending } from '../components/EmailVerificationPending';
import { GeneratedSetsDisclosure } from '../components/GeneratedSetsDisclosure';
import { FriendsSection } from '../components/FriendsSection';
import { ProfileShareError, shareProfile } from '../lib/profile-share';

type TogglePin = (badgeId: string, currentlyPinned: boolean) => void;

interface ProfileDashboardProps {
  profile: ProfileResponse;
  mutationError: string | null;
  onTogglePin: TogglePin;
  canManageBadges: boolean;
  onSaveProfile: (input: ProfileUpdate) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<string>;
  onLinkHackClub: () => void;
  onUnlinkHackClub: () => Promise<void>;
  onShareProfile: () => void;
  shareStatus: 'shared' | 'copied' | null;
  shareError: string | null;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not yet';
  return dateFormatter.format(new Date(value));
}

export function Profile() {
  const { userId, handle } = useParams<{ userId?: string; handle?: string }>();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [shareStatus, setShareStatus] = useState<'shared' | 'copied' | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    setMutationError(null);

    const fetchProfile = handle ? api.getProfileByHandle(handle) : userId ? api.getProfile(userId) : api.getMyProfile();
    fetchProfile
      .then(setProfile)
      .catch((e: unknown) => {
        setProfile(null);
         setLoadError(e instanceof Error ? e : new Error('Unable to load profile.'));
      })
      .finally(() => setLoading(false));
  }, [userId, handle, refreshIndex]);

  const handleSaveProfile = async (input: ProfileUpdate) => {
    const response = await api.updateMyProfile(input);
    setProfile((current) => current ? { ...current, user: current.user ? { ...current.user, ...response.user } : response.user } : current);
  };

  const handleUploadAvatar = async (file: File) => {
    const response = await api.uploadAvatar(file);
    setProfile((current) => current?.user ? { ...current, user: { ...current.user, avatarUrl: response.avatarUrl } } : current);
    return response.avatarUrl;
  };

  const handleUnlinkHackClub = async () => {
    const response = await api.unlinkHackClub();
    setProfile((current) => current?.user ? { ...current, user: { ...current.user, ...response.user } } : current);
  };

  const handleShareProfile = async () => {
    if (!profile?.user) throw new Error('Profile is unavailable.');
    const url = new URL(`/u/${encodeURIComponent(profile.user.displayName)}`, window.location.origin).toString();
    const result = await shareProfile(profile.user, url);
    setShareStatus(result);
    setShareError(null);
    return result;
  };

  const handleShareProfileClick = async () => {
    try {
      await handleShareProfile();
    } catch (error) {
      setShareStatus(null);
      setShareError(error instanceof ProfileShareError ? error.message : 'Unable to share this profile.');
    }
  };

  const handleTogglePin: TogglePin = async (badgeId, currentlyPinned) => {
    try {
      await api.pinBadge(badgeId, !currentlyPinned);
      setMutationError(null);
      setProfile((prev) => {
        if (!prev) return prev;
        const badge = prev.badges.find((item) => item.badgeId === badgeId);
        const badges = prev.badges.map((item) => (item.badgeId === badgeId ? { ...item, isPinned: !currentlyPinned } : item));
        const pinnedBadges = currentlyPinned
          ? prev.pinnedBadges.filter((item) => item.badgeId !== badgeId)
          : badge
            ? [...prev.pinnedBadges.filter((item) => item.badgeId !== badgeId), { ...badge, isPinned: true }]
            : prev.pinnedBadges;
        return { ...prev, badges, pinnedBadges };
      });
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Unable to update badge pin.');
    }
  };

  const content = searchParams.get('pendingEmail') === '1'
    ? <EmailVerificationPending />
    : loading
    ? renderLoading()
      : needsAccount(loadError) && !userId && !handle
      ? <NotLoggedIn feature="your profile" />
    : loadError || !profile
      ? renderError(loadError, () => setRefreshIndex((value) => value + 1))
      : renderDashboard({
          profile,
          mutationError,
          onTogglePin: handleTogglePin,
          canManageBadges: !userId && !handle,
          onSaveProfile: handleSaveProfile,
           onUploadAvatar: handleUploadAvatar,
           onLinkHackClub: () => api.linkHackClub(),
           onUnlinkHackClub: handleUnlinkHackClub,
           onShareProfile: () => void handleShareProfileClick(),
           shareStatus,
           shareError,
         });

  const isErrorState = (needsAccount(loadError) && !userId && !handle) || (loadError || !profile);
  const showOuterCard = !isErrorState && searchParams.get('pendingEmail') !== '1';

  const notice = searchParams.get('linked') === '1' ? 'Hack Club is linked. Choose your public username below.' : searchParams.get('upgraded') === '1' ? 'Your anonymous progress is now attached to your account.' : null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:py-10 lg:py-12">
      {showOuterCard ? (
        <div className="card overflow-hidden">
          {notice && <p className="mb-5 rounded-2xl border-2 border-accent/40 bg-accent/15 px-4 py-3 text-sm font-bold text-ink dark:text-gray-100" role="status">{notice}</p>}
          {content}
        </div>
      ) : (
        <>
          {notice && <p className="mb-5 rounded-2xl border-2 border-accent/40 bg-accent/15 px-4 py-3 text-sm font-bold text-ink dark:text-gray-100" role="status">{notice}</p>}
          {content}
        </>
      )}
    </div>
  );
}

function renderLoading(): ReactNode {

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)] lg:items-stretch">
        <section className="rounded-3xl border-2 border-ink/15 bg-white/80 p-5 dark:border-white/10 dark:bg-[var(--surface)] sm:p-7">
          <div className="flex flex-wrap items-start gap-4">
            <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-8 w-44 animate-pulse rounded bg-ink/10 dark:bg-[var(--surface-2)]" />
              <div className="h-4 w-full max-w-sm animate-pulse rounded bg-ink/10 dark:bg-[var(--surface-2)]" />
              <div className="flex gap-2 pt-1">
                <div className="h-6 w-24 animate-pulse rounded-md bg-ink/10 dark:bg-[var(--surface-2)]" />
                <div className="h-6 w-32 animate-pulse rounded-md bg-ink/10 dark:bg-[var(--surface-2)]" />
              </div>
            </div>
            <div className="ml-auto w-full shrink-0 sm:w-auto">
              <div className="h-11 w-full animate-pulse rounded-lg bg-ink/10 dark:bg-[var(--surface-2)] sm:w-40" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border-2 border-ink/10 bg-white/80 p-5 dark:border-white/10 dark:bg-[var(--surface)] sm:p-7">
          <div className="h-3 w-28 animate-pulse rounded bg-ink/10 dark:bg-[var(--surface-2)]" />
          <div className="mt-4 h-14 w-20 animate-pulse rounded bg-ink/10 dark:bg-[var(--surface-2)]" />
          <div className="mt-5 h-2 w-full animate-pulse rounded-full bg-ink/10 dark:bg-[var(--surface-2)]" />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-2xl border-2 border-ink/15 bg-white/75 p-4 dark:border-white/10 dark:bg-[var(--surface-2)]">
            <div className="h-8 w-14 animate-pulse rounded bg-ink/10 dark:bg-[var(--surface-2)]" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-ink/10 dark:bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function renderError(error: Error | null, onRetry: () => void): ReactNode {
  return (
    <StateCard
      badge="Error"
      title="Could not load profile"
      description={error?.message || 'User not found'}
      retryAction={onRetry}
    />
  );
}

function renderDashboard({ profile, mutationError, onTogglePin, canManageBadges, onSaveProfile, onUploadAvatar, onLinkHackClub, onUnlinkHackClub, onShareProfile, shareStatus, shareError }: ProfileDashboardProps): ReactNode {
  const accountUser = profile.user && 'hackclubId' in profile.user ? profile.user : null;
  const currentStreak = profile.streak?.currentStreak ?? 0;
  const longestStreak = profile.streak?.longestStreak ?? 0;
  const progress = Math.min(100, Math.max(0, (currentStreak / Math.max(longestStreak, 1)) * 100));
  const stats = [
    { label: 'Badges earned', value: profile.badges.length, accent: 'text-brand' },
    { label: 'Pinned favorites', value: profile.pinnedBadges.length, accent: 'text-accent' },
    { label: 'Best streak', value: longestStreak, accent: 'text-accent' },
  ];

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)] lg:items-stretch">
        <section className="relative overflow-hidden rounded-3xl border-2 border-ink/15 bg-white/80 p-5 dark:border-white/10 dark:bg-[var(--surface)] sm:p-7">

          <div className="relative flex flex-wrap items-start gap-4">
            <ProfileAvatar src={profile.user?.avatarUrl ?? null} alt={`${profile.user?.displayName ?? 'User'}'s profile picture`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h1 title={profile.user?.displayName} className="min-w-0 max-w-full truncate font-display text-3xl font-extrabold leading-none text-ink dark:text-gray-100 sm:max-w-none sm:text-4xl">{profile.user?.displayName}</h1>
                {accountUser?.hackclubId && <HackClubFlag className="h-5 w-5 shrink-0" />}
              </div>
               <div className="max-w-xl text-sm leading-6 text-ink/70 dark:text-gray-300">{profile.user?.bio ? <MarkdownBio source={profile.user.bio} /> : 'Guess, learn, and keep your streak alive. Your best moments are collected here.'}</div>
              <div className="flex flex-wrap gap-2 pt-1">
                {profile.user?.isDeveloper && <span className="chip chip-active">Developer</span>}
                <span className="chip chip-idle">Joined {formatDate(profile.user?.createdAt)}</span>
              </div>
            </div>
            <div className="ml-auto flex w-full shrink-0 items-center gap-3 sm:w-auto">
              <button type="button" className="btn-secondary" onClick={() => void onShareProfile()}>
                Share profile
              </button>
            </div>
          </div>

          {

}
          {(shareStatus || shareError) && (
            <p className="relative mt-3 text-sm font-bold text-ink/70 dark:text-gray-300" role="status" aria-live="polite">
              {shareError ?? (shareStatus === 'copied' ? 'Profile link copied.' : 'Profile shared.')}
            </p>
          )}
        </section>

        <section className="rounded-3xl border-2 border-ink/10 bg-white/80 p-5 text-ink dark:border-white/10 dark:bg-[var(--surface)] dark:text-white sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink/70 dark:text-white/55">Streak signal</p>
            <span className="rounded-md border border-ink/15 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink/70 dark:border-white/15 dark:text-accent">{currentStreak ? 'On a roll' : 'Start here'}</span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div><p className="font-display text-5xl font-extrabold leading-none tabular-nums text-accent dark:text-accent">{currentStreak}</p><p className="mt-2 text-sm font-bold text-ink/70 dark:text-white/70">day streak</p></div>
            <div className="text-right text-sm text-ink/70 dark:text-white/65"><p>Best: <span className="font-bold text-ink dark:text-white">{longestStreak}</span></p><p className="mt-1">Last played {formatDate(profile.streak?.lastPlayedOn)}</p></div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/15" role="progressbar" aria-label="Current streak compared with best streak" aria-valuemin={0} aria-valuemax={Math.max(longestStreak, 1)} aria-valuenow={currentStreak} aria-valuetext={`${currentStreak} day streak; best ${longestStreak}`}><div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} /></div>
          <div className="mt-4 grid grid-cols-7 gap-1.5" role="img" aria-label={`${Math.min(currentStreak, 7)} of 7 streak days shown active; current streak ${currentStreak} days`}>
            {Array.from({ length: 7 }, (_, index) => <span key={index} className={`h-1.5 rounded-full ${index < Math.min(currentStreak, 7) ? 'bg-accent' : 'bg-ink/10 dark:bg-white/15'}`} />)}
          </div>
        </section>
      </div>

      {canManageBadges && profile.user && 'hackclubId' in profile.user && <ProfileEditor bio={profile.user.bio} avatarUrl={profile.user.avatarUrl} hackclubId={profile.user.hackclubId} usernameChosen={profile.user.usernameChosen} canUnlinkHackClub={profile.user.authProvider === 'password' && profile.user.email !== null} onSave={onSaveProfile} onUploadAvatar={onUploadAvatar} onLinkHackClub={onLinkHackClub} onUnlinkHackClub={onUnlinkHackClub} />}
      {canManageBadges && profile.user && 'isOwner' in profile.user && profile.user.isOwner && <Link to="/admin" className="btn-secondary mt-4 w-full justify-center">Open owner badge tools</Link>}

      <GeneratedSetsDisclosure sets={profile.generatedSets} />

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => <div key={stat.label} className="rounded-2xl border-2 border-ink/15 bg-white/75 p-4 dark:border-white/10 dark:bg-[var(--surface)]"><p className={`font-display text-3xl font-extrabold tabular-nums ${stat.accent}`}>{stat.value}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.09em] text-ink/70 dark:text-gray-400">{stat.label}</p></div>)}
      </div>

      {mutationError && <div className="mt-5 rounded-2xl border-2 border-dashed border-ink/10 bg-white/75 p-4 dark:border-white/10 dark:bg-[var(--surface)]" role="alert" aria-live="polite"><p className="font-bold text-ink dark:text-gray-100">Badge pin update failed</p><p className="mt-1 text-sm text-ink/70 dark:text-gray-300">{mutationError}</p></div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="space-y-3 rounded-3xl border-2 border-ink/15 bg-white/75 p-5 dark:border-white/10 dark:bg-[var(--surface)]">
          <div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg font-bold text-ink dark:text-gray-100">Pinned badges</h2><span className="text-xs font-bold uppercase tracking-[0.11em] text-ink/70 dark:text-gray-400">{profile.pinnedBadges.length}</span></div>
           {profile.pinnedBadges.length > 0 ? <div className="flex flex-wrap gap-2">{profile.pinnedBadges.map((badge) => <BadgeChip key={badge.badgeId} badgeId={badge.badgeId} name={badge.badge.name} description={badge.badge.description} isPinned />)}</div> : <p className="rounded-2xl border-2 border-dashed border-ink/10 px-4 py-5 text-sm leading-6 text-ink/70 dark:border-white/10 dark:text-gray-300">Pin the badges you want people to notice first.</p>}
        </section>

        <section className="space-y-3 rounded-3xl border-2 border-ink/15 bg-white/75 p-5 dark:border-white/10 dark:bg-[var(--surface)]">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-ink dark:text-gray-100">Badge shelf</h2><p className="mt-1 text-sm text-ink/70 dark:text-gray-300">Tap a badge to pin or unpin it.</p></div><span className="chip chip-idle shrink-0">{profile.badges.length} total</span></div>
           {profile.badges.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-ink/10 p-4 text-sm text-ink/70 dark:text-gray-300">No badges yet. Keep playing to fill your shelf.</div> : <div className="flex flex-wrap gap-2">{profile.badges.map((badge) => <BadgeChip key={badge.badgeId} badgeId={badge.badgeId} name={badge.badge.name} description={badge.badge.description} isSecret={badge.badge.isSecret} isPinned={badge.isPinned} onTogglePin={canManageBadges ? () => onTogglePin(badge.badgeId, badge.isPinned) : undefined} />)}</div>}
        </section>
      </div>

      {canManageBadges && <FriendsSection />}
    </>
  );
}
