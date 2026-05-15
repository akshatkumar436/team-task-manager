import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, Eye, EyeOff, Layers } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    const { error } = await signIn(data.email, data.password);
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message.includes('Missing VITE_') || error.message.includes('Email not confirmed')
        ? error.message
        : 'Unable to sign in with those credentials');
      return;
    }

    toast.success('Signed in successfully');
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-1/2 flex-col justify-between bg-slate-950 p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
            <Layers size={18} className="text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">Planify</span>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-blue-300">Team workspace</p>
          <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight text-white">
            Organize projects, assign tasks, and track delivery in one focused dashboard.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            Planify keeps project progress, ownership, priorities, and activity visible for every team member.
          </p>
        </div>

        <p className="text-xs text-slate-500">Planify task management</p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500">
              <Layers size={15} className="text-white" />
            </div>
            <span className="font-semibold tracking-tight text-slate-800">Planify</span>
          </div>

          <h1 className="mb-1 text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="mb-7 text-sm text-slate-500">Sign in to your workspace</p>

          {!isSupabaseConfigured && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
              Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to `.env` to enable authentication.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Email</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Sign in <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New to Planify?{' '}
            <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-700">
              Create an account
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
