'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';

function getInitials(name) {
  return name?.split(' ').map((c) => c[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function getPhotoSrc(user) {
  if (!user) return '';
  return user.photo_url || user.photoURL || user.avatar_url || user.picture || '';
}

export default function UserAvatar({ user, size = 40, className = '', style = {}, alt }) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => getPhotoSrc(user), [user]);
  const initials = getInitials(user?.name || user?.email);

  if (!src || failed) {
    return (
      <div
        className={`avatar-placeholder ${className}`.trim()}
        style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.36)), ...style }}
      >
        {initials}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt || user?.name || 'User avatar'}
      width={size}
      height={size}
      className={className || 'avatar'}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
