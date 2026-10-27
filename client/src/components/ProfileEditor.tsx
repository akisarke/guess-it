import { errorMessage } from '../lib/api';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Link as LinkIcon, Save, Unlink, Upload, X } from 'lucide-react';
import type { ProfileUpdate } from '../lib/api';
import { ProfileAvatar } from './ProfileAvatar';

const MAX_AVATAR_BYTES = 50 * 1024 * 1024;

interface AvatarSelection {
  file: File;
  previewUrl: string;
}

function isAcceptedAvatarType(type: string): boolean {
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp' || type === 'image/gif';
}

interface ProfileEditorProps {
  bio: string | null;
  avatarUrl: string | null;
  hackclubId: string | null;
  usernameChosen: boolean;
  canUnlinkHackClub: boolean;
  displayName?: string;
  onSave: (input: ProfileUpdate) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<string>;
  onLinkHackClub: () => void;
  onUnlinkHackClub: () => Promise<void>;
  onClose?: () => void;
}

export function ProfileEditor({ bio, avatarUrl, displayName, hackclubId, usernameChosen, canUnlinkHackClub, onSave, onUploadAvatar, onLinkHackClub, onUnlinkHackClub, onClose }: ProfileEditorProps) {
  const [draftBio, setDraftBio] = useState(bio ?? '');
  const [avatarSelection, setAvatarSelection] = useState<AvatarSelection | null>(null);
  const [username, setUsername] = useState('');
  const [unlinking, setUnlinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    // jsdom has no showModal; fall back to a plain open dialog there
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, []);

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
      setError(errorMessage(saveError, 'Unable to save profile.'));
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
      setError(errorMessage(unlinkError, 'Unable to unlink Hack Club.'));
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id="edit-profile"
      aria-labelledby="edit-profile-heading"
      onCancel={(event) => {
        // Esc closes it, unless a username still has to be picked
        event.preventDefault();
        onClose?.();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      className="profile-editor-dialog"
    >
      <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-center justify-between gap-3 border-b-2 border-[var(--line-strong)] bg-[var(--surface)] px-5 py-4 sm:-mx-7 sm:-mt-7 sm:px-7">
        <h2 id="edit-profile-heading" className="font-display text-xl font-extrabold tracking-tight text-ink dark:text-gray-100 sm:text-2xl">Edit profile</h2>
        {onClose && (
          <button type="button" onClick={onClose} className="btn-secondary gap-1.5 px-3 py-1.5 text-xs">
            <X size={14} aria-hidden="true" /> Close
          </button>
        )}
      </div>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-ink dark:text-gray-100">Bio</span>
          <span id="bio-markdown-help" className="block text-xs leading-5 text-ink/70 dark:text-gray-400">
            Supports Markdown: <code>**bold**</code>, <code>*italic*</code>, <code>`code`</code>, <code>[link](https://…)</code>, <code># heading</code> and <code>- lists</code>.
          </span>
          <textarea value={draftBio} onChange={(event) => setDraftBio(event.target.value)} maxLength={280} rows={4} aria-describedby="bio-markdown-help" placeholder="What are you curious about?" className="w-full rounded-[3px] border-2 font-mono border-ink/10 bg-white/80 px-4 py-3 text-base leading-6 text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/25 dark:border-white/15 dark:bg-[var(--surface-2)] dark:text-gray-100 sm:text-sm" />
          <span className="block text-right text-xs text-ink/70 dark:text-gray-400">{draftBio.length}/280</span>
        </label>

        <div className="space-y-2">
          <span className="text-sm font-bold text-ink dark:text-gray-100">Profile picture</span>
          <div className="flex flex-col gap-3 rounded-[3px] border-2 border-ink/10 bg-white/80 p-3 dark:border-white/15 dark:bg-[var(--surface-2)] sm:flex-row sm:items-center">
            <ProfileAvatar src={avatarSelection?.previewUrl ?? avatarUrl} alt={avatarSelection ? 'Selected profile picture preview' : 'Current profile picture'} name={displayName} />
            <div className="min-w-0 flex-1">
              <label className="inline-flex cursor-pointer">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectAvatar} aria-describedby="avatar-upload-help avatar-upload-status" className="peer sr-only" />
                <span className="btn-secondary peer-focus-visible:ring-4 peer-focus-visible:ring-accent/40"><Upload size={16} aria-hidden="true" /> Choose image</span>
              </label>
              <p id="avatar-upload-help" className="mt-2 text-xs leading-5 text-ink/70 dark:text-gray-300">JPEG, PNG, WebP, or GIF. Maximum 50 MB.</p>
              <p id="avatar-upload-status" aria-live="polite" className="mt-1 break-words text-xs font-bold text-ink/80 dark:text-accent">{avatarSelection ? `${avatarSelection.file.name} selected. Save profile to upload.` : 'No new image selected.'}</p>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="rounded-[3px] border-2 border-brand/30 bg-brand/10 px-4 py-3 text-sm font-bold text-ink dark:text-gray-100">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary gap-2"><Save size={16} aria-hidden="true" />{saving ? 'Saving profile...' : 'Save profile'}</button>
          {saved && <span role="status" className="chip chip-active"><Check size={14} aria-hidden="true" /> Saved</span>}
        </div>
      </form>

      <div className="mt-6 border-t border-[var(--line)] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-bold text-ink dark:text-gray-100">Hack Club</p><p className="mt-1 text-xs text-ink/65 dark:text-gray-400">{hackclubId ? (usernameChosen ? 'Linked to this profile.' : 'Choose the username people will see.') : 'Connect Hack Club to show your profile identity.'}</p></div>
          {hackclubId && <span className="chip chip-active"><Check size={14} aria-hidden="true" /> Linked</span>}
        </div>
        {!hackclubId && (
          <button type="button" className="btn-secondary mt-4" onClick={onLinkHackClub}><LinkIcon size={16} aria-hidden="true" /> Link Hack Club</button>
        )}
        {hackclubId && !usernameChosen && (
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-bold text-ink dark:text-gray-100">Public username</span>
            <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={32} pattern="[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?" autoComplete="username" required aria-describedby="hackclub-username-help" className="min-h-11 w-full rounded-[2px] border-2 border-ink/10 bg-white/80 px-4 py-2 text-base text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/25 dark:border-white/15 dark:bg-[var(--surface-2)] dark:text-gray-100 sm:text-sm" />
            <span id="hackclub-username-help" className="block text-xs text-ink/65 dark:text-gray-400">Save your profile to choose a unique public username.</span>
          </label>
        )}
        {hackclubId && usernameChosen && (
          <div className="mt-4">
            {confirmUnlink ? (
              <div className="rounded-[3px] border-2 border-brand/30 bg-brand/10 p-4">
                <p className="text-sm font-bold text-ink dark:text-gray-100">Unlink Hack Club from this profile?</p>
                <p className="mt-1 text-xs leading-5 text-ink/70 dark:text-gray-300">This removes only the local connection. Your Hack Club account is unchanged.</p>
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => setConfirmUnlink(false)} disabled={unlinking}>Cancel</button><button type="button" className="btn-primary" onClick={unlinkHackClub} disabled={unlinking}><Unlink size={16} aria-hidden="true" />{unlinking ? 'Unlinking...' : 'Unlink Hack Club'}</button></div>
              </div>
            ) : canUnlinkHackClub ? (
              <button type="button" className="btn-secondary" onClick={() => setConfirmUnlink(true)}><Unlink size={16} aria-hidden="true" /> Unlink Hack Club</button>
            ) : <p className="text-xs leading-5 text-ink/65 dark:text-gray-400">Add a password and email before unlinking Hack Club.</p>}
          </div>
        )}
      </div>
    </dialog>
  );
}
