import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage, api, needsAccount, type ProfileResponse } from '../lib/api';
import { getScoreBand, type ScoreBand } from 'shared';
import { BadgeShelf } from '../components/BadgeShelf';
import { VisitorActions } from '../components/VisitorActions';
import { formatScore } from '../lib/format-number';
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
import { SectionHeading } from '../components/SectionHeading';
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
  onDeleteGeneratedSet?: (id: string) => void;
  editing: boolean;
  onToggleEdit: () => void;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not yet';
  return dateFormatter.format(new Date(value));
}

const monthDayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function formatShortDate(value: string | null | undefined) {
  return value ? monthDayFormatter.format(new Date(value)) : 'Not yet';
}

// the year only earns a line when it isn't this year
function lastPlayedYear(value: string | null | undefined) {
  if (!value) return '';
  const year = new Date(value).getFullYear();
  return year === new Date().getFullYear() ? '' : String(year);
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
  const [editing, setEditing] = useState(false);

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
      setMutationError(errorMessage(e, 'Unable to update badge pin.'));
    }
  };

  const handleDeleteGeneratedSet = async (setId: string) => {
    if (!confirm('Delete this generated set? This cannot be undone.')) return;
    try {
      await api.deleteGeneratedSet(setId);
      setProfile((prev) => prev ? { ...prev, generatedSets: prev.generatedSets.filter((s) => s.id !== setId) } : prev);
    } catch (e) {
      setMutationError(errorMessage(e, 'Unable to delete generated set.'));
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
           onDeleteGeneratedSet: (setId) => void handleDeleteGeneratedSet(setId),
           editing,
           onToggleEdit: () => setEditing((value) => !value),
         });

  const isOwnProfile = !userId && !handle;
  const usernameChosen = isOwnProfile && profile?.user && 'usernameChosen' in profile.user ? profile.user.usernameChosen : undefined;
  const needsUsername = isOwnProfile && usernameChosen === false;
  const notice = searchParams.get('linked') === '1' && needsUsername
    ? 'Hack Club is linked. Choose your public username below.'
    : searchParams.get('upgraded') === '1'
      ? `Your anonymous progress is now attached to your account.${needsUsername ? ' Choose your public username below.' : ''}`
      : null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:py-10 lg:py-12">
      {notice && <p className="mb-6 border-[1.5px] border-[var(--line-strong)] bg-accent/15 px-4 py-3 text-sm font-bold text-ink dark:text-gray-100" role="status">{notice}</p>}
      {content}
    </div>
  );
}

function renderLoading(): ReactNode {

  return (
    <div className="py-2">
      <p className="text-[0.68rem] font-bold tracking-[0.04em] opacity-55">Loading profile</p>
      <div className="mt-3 border-t-2 border-[var(--line-strong)]" />
    </div>
  );
}

function renderError(error: Error | null, onRetry: () => void): ReactNode {
  return (
    <StateCard
      badge="Error"
      title="Could not load profile"
      description={errorMessage(error, 'Unable to load profile. Try again later.')}
      retryAction={onRetry}
    />
  );
}

const bandBar: Record<ScoreBand, string> = {
  close: 'bg-accent',
  medium: 'bg-[var(--line-strong)]',
  far: 'bg-brand',
};

const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function RecentDays({ days }: { days: NonNullable<ProfileResponse['skill']>['recentDays'] }) {
  if (days.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-xs font-bold text-ink/70 dark:text-gray-400">Last {days.length === 1 ? 'day' : `${days.length} days`} played · average miss</p>
      <ol className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((day, index) => (
          <li key={day.date} className="min-w-0">
            <span className={`bar-draw block h-1.5 ${bandBar[getScoreBand(day.averageMiss)]}`} style={{ animationDelay: `${120 + index * 60}ms` }} aria-hidden="true" />
            <span className="mt-1.5 block font-display text-base font-extrabold tabular-nums text-ink dark:text-gray-100">{formatScore(day.averageMiss).visual}</span>
            <span className="block text-xs font-bold text-ink/70 dark:text-gray-400">{shortDate.format(new Date(day.date))}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function renderDashboard({ profile, mutationError, onTogglePin, canManageBadges, onSaveProfile, onUploadAvatar, onLinkHackClub, onUnlinkHackClub, onShareProfile, shareStatus, shareError, onDeleteGeneratedSet, editing, onToggleEdit }: ProfileDashboardProps): ReactNode {
  const accountUser = profile.user && 'hackclubId' in profile.user ? profile.user : null;
  const displayName = profile.user?.displayName ?? 'Player';
  const isOwner = canManageBadges && profile.user !== null && 'isOwner' in profile.user && profile.user.isOwner;
  const currentStreak = profile.streak?.currentStreak ?? 0;
  const longestStreak = profile.streak?.longestStreak ?? 0;
  const skill = profile.skill;
  const days = (count: number) => (count === 1 ? 'day' : 'days');
  const stats: Array<{ label: string; value: string | number; unit: string; hint?: ReactNode }> = [
    {
      label: 'Average miss',
      value: skill?.averageMiss != null ? formatScore(skill.averageMiss).visual : '—',
      unit: skill?.questionsPlayed ? `${skill.questionsPlayed} ${skill.questionsPlayed === 1 ? 'question' : 'questions'}` : 'no daily guesses yet',
    },
    {
      label: 'Best guess',
      value: skill?.bestMiss != null ? formatScore(skill.bestMiss).visual : '—',
      unit: skill?.bestMiss != null ? 'closest so far' : '',
    },
    currentStreak > 0
      ? { label: 'Streak', value: currentStreak, unit: days(currentStreak), hint: `Best ${longestStreak}` }
      : {
          label: 'Best streak',
          value: longestStreak,
          unit: days(longestStreak),
          hint: canManageBadges ? <Link to="/" className="underline decoration-accent decoration-2 underline-offset-4">play today</Link> : undefined,
        },
    { label: 'Last played', value: formatShortDate(profile.streak?.lastPlayedOn), unit: lastPlayedYear(profile.streak?.lastPlayedOn) },
  ];
  // pinned badges lead the shelf; sort is stable, so the rest keep their order
  const shelf = [...profile.badges].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  const showEditor = canManageBadges && accountUser !== null && (editing || !accountUser.usernameChosen);

  return (
    <>
      <article className="front-page">
        <div className="px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            <ProfileAvatar src={profile.user?.avatarUrl ?? null} alt={`${displayName}'s profile picture`} name={displayName} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h1 title={displayName} className="min-w-0 truncate font-display text-4xl font-extrabold leading-none text-ink dark:text-gray-100 sm:text-5xl">{displayName}</h1>
                {accountUser?.hackclubId && <HackClubFlag className="h-5 w-5 shrink-0" />}
              </div>
              {profile.user?.bio && (
                <div className="mt-3 max-w-prose text-sm leading-6 text-ink/80 dark:text-gray-300">
                  <MarkdownBio source={profile.user.bio} />
                </div>
              )}
              <p className="mt-3 text-xs font-bold text-ink/70 dark:text-gray-400">
                Joined {formatDate(profile.user?.createdAt)}
                {profile.user?.isDeveloper && ' · Developer'}
                {isOwner && <> · <Link to="/admin" className="underline decoration-accent decoration-2 underline-offset-4 hover:text-ink dark:hover:text-white">Badge tools</Link></>}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-[13rem] sm:flex-col sm:items-stretch">
              {canManageBadges ? (
                accountUser && (
                  <button type="button" className="btn-secondary" aria-haspopup="dialog" onClick={onToggleEdit}>
                    Edit profile
                  </button>
                )
              ) : (
                profile.user && <VisitorActions userId={profile.user.id} displayName={displayName} />
              )}
              <button type="button" className="btn-secondary" onClick={() => void onShareProfile()}>
                Share profile
              </button>
            </div>
          </div>

          {(shareStatus || shareError) && (
            <p className="mt-4 text-sm font-bold text-ink/80 dark:text-gray-300" role="status" aria-live="polite">
              {shareError ?? (shareStatus === 'copied' ? 'Profile link copied.' : 'Profile shared.')}
            </p>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-px border-y-2 border-[var(--line-strong)] bg-[var(--line)] sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col bg-[var(--surface)] py-4 pl-4 pr-3 [&:nth-child(odd)]:pl-0 sm:[&:nth-child(odd)]:pl-4 sm:first:!pl-0">
                <dt className="text-xs font-bold text-ink/70 dark:text-gray-400">{stat.label}</dt>
                <dd className="mt-2 font-display text-2xl font-extrabold leading-none tabular-nums text-ink dark:text-gray-100 sm:text-3xl">{stat.value}</dd>
                {(stat.unit || stat.hint) && (
                  <dd className="mt-1.5 text-xs font-bold text-ink/70 dark:text-gray-400">
                    {stat.unit}
                    {stat.unit && stat.hint && ' · '}
                    {stat.hint}
                  </dd>
                )}
              </div>
            ))}
          </dl>

          {skill && <RecentDays days={skill.recentDays} />}
        </div>
      </article>

      {showEditor && accountUser && <ProfileEditor bio={accountUser.bio} avatarUrl={accountUser.avatarUrl} displayName={accountUser.displayName} hackclubId={accountUser.hackclubId} usernameChosen={accountUser.usernameChosen} canUnlinkHackClub={accountUser.authProvider === 'password' && accountUser.email !== null} onSave={onSaveProfile} onUploadAvatar={onUploadAvatar} onLinkHackClub={onLinkHackClub} onUnlinkHackClub={onUnlinkHackClub} onClose={accountUser.usernameChosen ? onToggleEdit : undefined} />}

      <section aria-labelledby="badges-heading" className="mt-12">
        <SectionHeading id="badges-heading" title="Badges" aside={`${profile.badges.length} earned · ${profile.pinnedBadges.length} pinned`} />
        {canManageBadges && profile.badges.length > 0 && (
          <p className="mt-3 text-sm leading-6 text-ink/75 dark:text-gray-300">Tap a badge to pin it. Pinned badges show first when people visit your profile.</p>
        )}
        {mutationError && <p className="mt-3 text-sm font-bold text-brand" role="alert">Couldn&apos;t update that. {mutationError}</p>}
        {shelf.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-ink/75 dark:text-gray-300">
            {canManageBadges ? 'No badges yet. Keep playing to fill the shelf.' : `${displayName} hasn't earned any badges yet.`}
          </p>
        ) : (
          <BadgeShelf badges={shelf} onTogglePin={canManageBadges ? onTogglePin : undefined} />
        )}
      </section>

      <GeneratedSetsDisclosure sets={profile.generatedSets} onDelete={canManageBadges ? onDeleteGeneratedSet : undefined} ownerName={canManageBadges ? undefined : displayName} />

      {canManageBadges && <FriendsSection />}
    </>
  );
}
