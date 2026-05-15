import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { getInitials, getAvatarColor } from '../lib/utils';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { profile, updateProfile } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? '' },
  });

  const onSaveProfile = async (data: ProfileFormData) => {
    setSavingProfile(true);
    await updateProfile({ full_name: data.full_name });
    setSavingProfile(false);
    toast.success('Profile updated');
  };

  return (
    <div className="p-5 lg:p-6 max-w-xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your account and preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold"
            style={{ backgroundColor: getAvatarColor(profile?.full_name || 'U') }}
          >
            {getInitials(profile?.full_name || 'User')}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{profile?.full_name}</p>
            <p className="text-xs text-slate-400">{profile?.email}</p>
          </div>
        </div>
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Full name</label>
            <input
              {...profileForm.register('full_name')}
              type="text"
              className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {profileForm.formState.errors.full_name && (
              <p className="mt-1 text-xs text-red-500">{profileForm.formState.errors.full_name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
            <input
              value={profile?.email ?? ''}
              disabled
              type="email"
              className="w-full text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 bg-slate-50 text-slate-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-400">Email cannot be changed</p>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {savingProfile ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Account</h2>
        <p className="text-xs text-slate-400 mb-3">Your account is secured and active.</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-slate-500">Active session</span>
        </div>
      </div>
    </div>
  );
}
