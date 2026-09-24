'use client';

import { useState } from 'react';
import { HelpCircle, Search, ChevronDown, ChevronRight, BookOpen, CreditCard, User, AlertCircle, MessageSquare } from 'lucide-react';
import Link from 'next/link';

const categories = [
  {
    icon: BookOpen,
    title: 'Booking',
    questions: [
      {
        q: 'How do I book tickets?',
        a: 'Browse events, select your seats from the seat map, and complete the payment. You\'ll receive instant confirmation with your digital tickets.',
      },
      {
        q: 'Can I book multiple seats?',
        a: 'Yes! You can select up to 10 seats per booking. All seats must be in the same event.',
      },
      {
        q: 'How long are my seats held?',
        a: 'Selected seats are held for 15 minutes while you complete checkout. After that, they\'re released for others to book.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit/debit cards, UPI, net banking, and popular wallets through our secure payment gateway.',
      },
    ],
  },
  {
    icon: AlertCircle,
    title: 'Cancellation & Refunds',
    questions: [
      {
        q: 'How do I cancel a booking?',
        a: 'Go to My Bookings, find the booking you want to cancel, and click the Cancel button. You can cancel up to 24 hours before the event.',
      },
      {
        q: 'When will I receive my refund?',
        a: 'Refunds are processed within 5–7 business days and credited to your original payment method.',
      },
      {
        q: 'Can I get a refund after the event?',
        a: 'Unfortunately, refunds are not available after the event has taken place.',
      },
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments',
    questions: [
      {
        q: 'Is my payment secure?',
        a: 'Yes. We use industry-standard encryption and PCI-compliant payment processing. Your card details are never stored on our servers.',
      },
      {
        q: 'Why was my payment declined?',
        a: 'Payments can be declined due to insufficient funds, incorrect card details, or bank restrictions. Please try again or use a different payment method.',
      },
      {
        q: 'Can I pay in installments?',
        a: 'Currently, we support full upfront payment only. Installment options may be available for select premium events.',
      },
    ],
  },
  {
    icon: User,
    title: 'Account',
    questions: [
      {
        q: 'How do I create an account?',
        a: 'Click Sign Up, enter your email address, and verify with the OTP code sent to your inbox. No password needed!',
      },
      {
        q: 'How do I log in?',
        a: 'Click Log In, enter your email, and verify with the 6-digit code sent to your email. It\'s that simple.',
      },
      {
        q: 'Can I change my email address?',
        a: 'Please contact our support team to update your email address. We\'ll verify your identity before making the change.',
      },
    ],
  },
];

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const allQuestions = categories.flatMap((cat) =>
    cat.questions.map((q) => ({ ...q, category: cat.title }))
  );

  const filtered = search
    ? allQuestions.filter(
        (q) =>
          q.q.toLowerCase().includes(search.toLowerCase()) ||
          q.a.toLowerCase().includes(search.toLowerCase()),
      )
    : null;

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="py-16 bg-gradient-to-b from-dark-900 to-dark-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-brand-500/10 mb-4">
            <HelpCircle className="h-6 w-6 text-brand-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">How can we help?</h1>
          <p className="text-dark-400 mb-8">
            Search for answers or browse the topics below.
          </p>

          {/* Search */}
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-dark-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for help..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
            />
          </div>
        </div>
      </section>

      {/* Search results */}
      {filtered && (
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg font-bold mb-4">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
            </h2>
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-dark-400 mb-4">No results found for &ldquo;{search}&rdquo;</p>
                <p className="text-sm text-dark-500">
                  Try different keywords or{' '}
                  <Link href="/contact" className="text-brand-400 hover:text-brand-300">
                    contact our support team
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((q, i) => (
                  <div key={i} className="rounded-xl border border-dark-800 bg-dark-900/50">
                    <button
                      onClick={() => setOpenQuestion(openQuestion === q.q ? null : q.q)}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <div>
                        <span className="text-xs text-brand-400 font-medium">{q.category}</span>
                        <h3 className="text-sm font-medium mt-0.5">{q.q}</h3>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-dark-500 shrink-0 transition-transform ${
                          openQuestion === q.q ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {openQuestion === q.q && (
                      <div className="px-4 pb-4 text-sm text-dark-400 border-t border-dark-800 pt-3">
                        {q.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Categories */}
      {!filtered && (
        <section className="py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat) => (
                <div key={cat.title} className="rounded-2xl border border-dark-800 bg-dark-900/50 p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                      <cat.icon className="h-5 w-5 text-brand-400" />
                    </div>
                    <h2 className="text-lg font-bold">{cat.title}</h2>
                  </div>
                  <div className="space-y-3">
                    {cat.questions.map((q) => (
                      <div key={q.q} className="border-t border-dark-800 pt-3">
                        <button
                          onClick={() => setOpenQuestion(openQuestion === q.q ? null : q.q)}
                          className="w-full flex items-center justify-between text-left"
                        >
                          <span className="text-sm font-medium text-dark-200">{q.q}</span>
                          <ChevronDown
                            className={`h-4 w-4 text-dark-500 shrink-0 ml-3 transition-transform ${
                              openQuestion === q.q ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {openQuestion === q.q && (
                          <p className="text-sm text-dark-400 mt-2 leading-relaxed">{q.a}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact CTA */}
      <section className="py-16 border-t border-dark-800/50">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <MessageSquare className="h-8 w-8 text-brand-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Still need help?</h2>
          <p className="text-dark-400 text-sm mb-6">
            Our support team is available Monday–Saturday, 9 AM – 8 PM IST.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-brand-500/20"
          >
            Contact Support
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
