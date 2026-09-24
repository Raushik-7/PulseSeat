import Link from 'next/link';
import { Shield, FileText, RotateCcw, ArrowLeft } from 'lucide-react';

interface PolicyLayoutProps {
  icon: 'privacy' | 'terms' | 'refund';
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}

const icons = {
  privacy: Shield,
  terms: FileText,
  refund: RotateCcw,
};

export function PolicyLayout({ icon, title, updated, intro, children }: PolicyLayoutProps) {
  const Icon = icons[icon];
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-dark-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <header className="mb-10 pb-8 border-b border-dark-800">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/20 mb-4">
          <Icon className="h-6 w-6 text-brand-400" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-dark-400 mb-3">{intro}</p>
        <p className="text-xs text-dark-500">Last updated: {updated}</p>
      </header>

      <div className="prose-pulseseat space-y-8">{children}</div>

      <div className="mt-12 rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
        <p className="text-sm text-dark-400">
          This is a demo project — these policies are illustrative samples for a portfolio application and are not
          legally reviewed documents. Questions? Reach us via the{' '}
          <Link href="/contact" className="text-brand-400 hover:underline">contact page</Link>.
        </p>
      </div>
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={undefined}>
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-sm text-dark-400 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
