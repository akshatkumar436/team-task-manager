import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Layers, ArrowLeft, CheckCircle } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const schema = z.object({ email: z.string().email('Enter a valid email') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!isSupabaseConfigured) {
      toast.error('Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSubmitting(false);
    if (error) {
      toast.error('Failed to send reset email');
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2 mb-10">
          <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center">
            <Layers size={15} className="text-white" />
          </div>
          <span className="font-semibold text-slate-800 tracking-tight">Planify</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-600" size={22} />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Check your inbox</h1>
            <p className="text-slate-500 text-sm mb-6">
              We sent a password reset link to your email address. It may take a minute to arrive.
            </p>
            <Link to="/login" className="text-blue-600 text-sm font-medium hover:text-blue-700 flex items-center justify-center gap-1.5">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">Reset password</h1>
            <p className="text-slate-500 text-sm mb-7">
              Enter your email and we'll send you a reset link.
            </p>
            {!isSupabaseConfigured && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
                Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to a local `.env` file to enable password reset.
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@company.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-400"
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
