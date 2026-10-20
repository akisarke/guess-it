import { useState } from 'react';
import { resolveApiAssetUrl } from '../lib/api';

interface ProfileAvatarProps {
  src: string | null;
  alt: string;
}

export function ProfileAvatar({ src, alt }: ProfileAvatarProps) {
  const resolvedSrc = resolveApiAssetUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (resolvedSrc && resolvedSrc !== failedSrc) {
    return (
      <span className="profile-avatar">
        <img
          src={resolvedSrc}
          alt={alt}
          width="64"
          height="64"
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(resolvedSrc)}
        />
      </span>
    );
  }

  return (
    <span className="profile-avatar profile-avatar-fallback" role="img" aria-label={alt}>
      <span aria-hidden="true">G</span>
    </span>
  );
}
