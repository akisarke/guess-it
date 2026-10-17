import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, ChevronDown, ChevronUp, Link as LinkIcon, Save, Unlink, Upload } from 'lucide-react';
import type { ProfileUpdate } from '../lib/api';
import { ProfileAvatar } from './ProfileAvatar';

const MAX_AVATAR_BYTES = 50 * 1024 * 1024;

interface AvatarSelection {
  readonly file: File;
  readonly previewUrl: string;
}

function isAcceptedAvatarType(type: string): boolean {
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp' || type === 'image/gif';
}

interface ProfileEditorProps {
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly hackclubId: string | null;
  readonly usernameChosen: boolean;
  readonly canUnlinkHackClub: boolean;
  readonly onSave: (input: ProfileUpdate) => Promise<void>;
  readonly onUploadAvatar: (file: File) => Promise<string>;
  readonly onLinkHackClub: () => void;
  readonly onUnlinkHackClub: () => Promise<void>;
}

export function ProfileEditor({ bio, avatarUrl, hackclubId, usernameChosen, canUnlinkHackClub, onSave, onUploadAvatar, onLinkHackClub, onUnlinkHackClub }: ProfileEditorProps) {
  const [draftBio, setDraftBio] = useState(bio ?? '');
  const [avatarSelection, setAvatarSelection] = useState<AvatarSelection | null>(null);
  const [username, setUsername] = useState('');
  const [expanded, setExpanded] = useState(!usernameChosen);
  const [unlinking, setUnlinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (avatarSelection) URL.revokeObjectURL(avatarSelection.previewUrl);
    };
  }, [avatarSelection]);

  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.item(0);
    if (!file) return;

    setSaved(false);
    if (!isAcceptedAvatarType(file.type)) {
      setError('Choose a JPEG, PNG, WebP, or GIF image.');
      event.currentTarget.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Profile pictures must be 50 MB or smaller.');
      event.currentTarget.value = '';
      return;
    }

    setError(null);
    setAvatarSelection({ file, previewUrl: URL.createObjectURL(file) });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      if (avatarSelection) await onUploadAvatar(avatarSelection.file);
      await onSave({ bio: draftBio.trim() || null, ...(hackclubId && !usernameChosen ? { displayName: username.trim() } : {}) });
      setAvatarSelection(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const unlinkHackClub = async () => {
    setUnlinking(true);
    setError(null);
    try {
      await onUnlinkHackClub();
      setConfirmUnlink(false);
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : 'Unable to unlink Hack Club.');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} className="mt-6 rounded-3xl border-2 border-hc-ink/15 bg-white/75 p-5 dark:border-white/10 dark:bg-white/5 sm:p-6">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-hc-violet/40">
        <div>
          <h2 className="font-display text-lg font-bold text-hc-ink dark:text-gray-100">Edit profile</h2>
          <p className="mt-1 text-sm leading-6 text-hc-ink/70 dark:text-gray-300">{expanded ? 'Bio, profile image, and Hack Club connection.' : 'Expand to update your profile.'}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {saved && <span className="chip chip-active"><Check size={14} aria-hidden="true" /> Saved</span>}
          {expanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
        </span>
      </summary>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-hc-ink dark:text-gray-100">Bio</span>
          <textarea value={draftBio} onChange={(event) => setDraftBio(event.target.value)} maxLength={280} rows={3} placeholder="What are you curious about?" className="w-full rounded-2xl border-2 border-hc-ink/10 bg-white/80 px-4 py-3 text-base leading-6 text-hc-ink outline-none transition focus:border-hc-violet focus:ring-4 focus:ring-hc-violet/25 dark:border-white/15 dark:bg-white/10 dark:text-gray-100 sm:text-sm" />
          <span className="block text-right text-xs text-hc-ink/55 dark:text-gray-400">{draftBio.length}/280</span>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-semibold text-hc-ink dark:text-gray-100">Profile picture</span>
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-hc-ink/10 bg-white/80 p-3 dark:border-white/15 dark:bg-white/10 sm:flex-row sm:items-center">
            <ProfileAvatar src={avatarSelection?.previewUrl ?? avatarUrl} alt={avatarSelection ? 'Selected profile picture preview' : 'Current profile picture'} />
            <div className="min-w-0 flex-1">
              <label className="inline-flex cursor-pointer">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectAvatar} aria-describedby="avatar-upload-help avatar-upload-status" className="peer sr-only" />
                <span className="btn-secondary peer-focus-visible:ring-4 peer-focus-visible:ring-hc-violet/40"><Upload size={16} aria-hidden="true" /> Choose image</span>
              </label>
              <p id="avatar-upload-help" className="mt-2 text-xs leading-5 text-hc-ink/65 dark:text-gray-400">JPEG, PNG, WebP, or GIF. Maximum 50 MB.</p>
              <p id="avatar-upload-status" aria-live="polite" className="mt-1 break-words text-xs font-semibold text-hc-violet dark:text-hc-yellow">{avatarSelection ? `${avatarSelection.file.name} selected. Save profile to upload.` : 'No new image selected.'}</p>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="rounded-2xl border-2 border-hc-pink/30 bg-hc-pink/10 px-4 py-3 text-sm font-semibold text-hc-ink dark:text-pink-100">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary"><Save size={16} aria-hidden="true" />{saving ? 'Saving profile…' : 'Save profile'}</button>
      </form>

      <div className="mt-5 border-t border-hc-ink/10 pt-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-hc-ink dark:text-gray-100">Hack Club</p><p className="mt-1 text-xs text-hc-ink/65 dark:text-gray-400">{hackclubId ? (usernameChosen ? 'Linked to this profile.' : 'Choose the username people will see.') : 'Connect Hack Club to show your profile identity.'}</p></div>
          {hackclubId && <span className="chip chip-active"><Check size={14} aria-hidden="true" /> Linked</span>}
        </div>
        {!hackclubId && (
          <button type="button" className="btn-secondary mt-4" onClick={onLinkHackClub}><LinkIcon size={16} aria-hidden="true" /> Link Hack Club</button>
        )}
        {hackclubId && !usernameChosen && (
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-semibold text-hc-ink dark:text-gray-100">Public username</span>
            <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={32} pattern="[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?" autoComplete="username" required aria-describedby="hackclub-username-help" className="min-h-11 w-full rounded-full border-2 border-hc-ink/10 bg-white/80 px-4 py-2 text-base text-hc-ink outline-none focus:border-hc-violet focus:ring-4 focus:ring-hc-violet/25 dark:border-white/15 dark:bg-white/10 dark:text-gray-100 sm:text-sm" />
            <span id="hackclub-username-help" className="block text-xs text-hc-ink/65 dark:text-gray-400">Save your profile to choose a unique public username.</span>
          </label>
        )}
        {hackclubId && usernameChosen && (
          <div className="mt-4">
            {confirmUnlink ? (
              <div className="rounded-2xl border-2 border-hc-pink/30 bg-hc-pink/10 p-4">
                <p className="text-sm font-semibold text-hc-ink dark:text-gray-100">Unlink Hack Club from this profile?</p>
                <p className="mt-1 text-xs leading-5 text-hc-ink/70 dark:text-gray-300">This removes only the local connection. Your Hack Club account is unchanged.</p>
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => setConfirmUnlink(false)} disabled={unlinking}>Cancel</button><button type="button" className="btn-primary" onClick={unlinkHackClub} disabled={unlinking}><Unlink size={16} aria-hidden="true" />{unlinking ? 'Unlinking…' : 'Unlink Hack Club'}</button></div>
              </div>
            ) : canUnlinkHackClub ? (
              <button type="button" className="btn-secondary" onClick={() => setConfirmUnlink(true)}><Unlink size={16} aria-hidden="true" /> Unlink Hack Club</button>
            ) : <p className="text-xs leading-5 text-hc-ink/65 dark:text-gray-400">Add a password and email before unlinking Hack Club.</p>}
          </div>
        )}
      </div>
    </details>
  );
}
