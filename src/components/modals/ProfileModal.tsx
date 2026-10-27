import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Users, X } from 'lucide-react';
import { CAST_ROLES } from '../../data/lesMisTracks';
import { SectionGroup, UserProfileDoc } from '../../types/rehearsal';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  userProfile: UserProfileDoc;
  onSaveProfile: (updated: UserProfileDoc) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userProfile,
  onSaveProfile,
}) => {
  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [characterRole, setCharacterRole] = useState(userProfile.characterRole);
  const [sectionGroup, setSectionGroup] = useState<SectionGroup>(
    userProfile.sectionGroup
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      uid: userProfile.uid,
      displayName: displayName.trim() || '劇組同學',
      characterRole,
      sectionGroup,
    });
    onClose();
  };

  const handleRoleSelect = (roleName: string) => {
    setCharacterRole(roleName);
    const matched = CAST_ROLES.find((r) => r.role === roleName);
    if (matched) {
      setSectionGroup(matched.section);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-ui-fade-in">
      <div className="w-full max-w-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 space-y-5 shadow-2xl animate-ui-pop">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--accent-gold)]" />
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
              設定劇組演員身分與聲部
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[var(--text-muted)] mb-1">
              姓名／排練稱呼
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-gold)]"
              required
            />
          </div>

          <div>
            <label className="block text-[var(--text-muted)] mb-1">
              演出角色分配（自動設定唱段篩選與走位提示）
            </label>
            <select
              value={characterRole}
              onChange={(e) => handleRoleSelect(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
            >
              {CAST_ROLES.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[var(--text-muted)] mb-1">
              所屬聲部／組別
            </label>
            <select
              value={sectionGroup}
              onChange={(e) => setSectionGroup(e.target.value as SectionGroup)}
              className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm"
            >
              <option value="Principal Cast">Principal Cast (主要角色領唱)</option>
              <option value="Soprano / Alto">
                Soprano / Alto (女高／女低合唱群)
              </option>
              <option value="Tenor / Bass">Tenor / Bass (男高／男低合唱群)</option>
              <option value="Stage Direction">
                Stage Direction (導演／舞台監督／後台群)
              </option>
            </select>
          </div>

          {currentUser && (
            <p className="text-[11px] text-[var(--text-muted)]">
              已綁定 Google 帳號：{currentUser.email}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[var(--accent-gold)] text-black font-bold hover:opacity-90 transition-opacity"
            >
              儲存身分設定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
