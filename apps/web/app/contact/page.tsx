'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, Send, Loader2, MessageSquare, Clock, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/toast';

const contactInfo = [
  {
    icon: Mail,
    title: 'Email',
    value: 'support@pulseseat.com',
    desc: 'We reply within 24 hours',
  },
  {
    icon: Phone,
    title: 'Phone',
    value: '+91 1800-123-4567',
    desc: 'Mon–Sat, 9 AM – 8 PM IST',
  },
  {
    icon: MapPin,
    title: 'Office',
    value: 'Bangalore, India',
    desc: 'Koramangala, 4th Block',
  },
];

const faqs = [
  {
    q: 'How do I cancel a booking?',
    a: 'Go to My Bookings, find your booking, and click Cancel. Refunds are processed within 5–7 business days.',
  },
  {
    q: 'Can I change my seats after booking?',
    a: 'You can cancel your current booking (if eligible) and rebook new seats. Seat changes on existing bookings are not supported.',
  },
  {
    q: 'When will I receive my tickets?',
    a: 'Your tickets are available instantly in My Bookings after payment. You can also download them as a PDF.',
  },
  {
    q: 'Is my payment secure?',
    a: 'Yes. We use industry-standard encryption and secure payment processing. We never store your card details.',
  },
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate form submission
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSubmitted(true);
    toast({ title: 'Message sent! We\'ll get back to you soon.', type: 'success' });
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="py-16 bg-gradient-to-b from-dark-900 to-dark-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-brand-500/10 mb-4">
            <MessageSquare className="h-6 w-6 text-brand-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Get in touch</h1>
          <p className="text-dark-400 max-w-lg mx-auto">
            Have a question about your booking, need help, or want to partner with us? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact cards + Form */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Left — Info */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-bold">Contact Information</h2>
              <p className="text-sm text-dark-400">
                Reach out through any of these channels. Our team is here to help.
              </p>

              <div className="space-y-4">
                {contactInfo.map((item) => (
                  <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl bg-dark-900 border border-dark-800">
                    <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-sm text-dark-300">{item.value}</p>
                      <p className="text-xs text-dark-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-dark-500 pt-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Average response time: 4 hours</span>
              </div>
            </div>

            {/* Right — Form */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-dark-800 bg-dark-900/50 p-6 sm:p-8">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-500/10 mb-4">
                      <CheckCircle className="h-7 w-7 text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Message sent!</h3>
                    <p className="text-dark-400 text-sm mb-6">
                      We&apos;ll get back to you within 24 hours. Check your email for updates.
                    </p>
                    <button
                      onClick={() => { setSubmitted(false); setName(''); setEmail(''); setSubject(''); setMessage(''); }}
                      className="px-6 py-2.5 text-sm font-medium border border-dark-700 rounded-lg hover:bg-dark-800 transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <h3 className="text-lg font-bold">Send us a message</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          required
                          className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-300 mb-1.5">Email</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-1.5">Subject</label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                      >
                        <option value="" className="bg-dark-800">Select a topic</option>
                        <option value="booking" className="bg-dark-800">Booking issue</option>
                        <option value="payment" className="bg-dark-800">Payment problem</option>
                        <option value="refund" className="bg-dark-800">Refund request</option>
                        <option value="account" className="bg-dark-800">Account help</option>
                        <option value="partner" className="bg-dark-800">Business partnership</option>
                        <option value="other" className="bg-dark-800">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-300 mb-1.5">Message</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us how we can help..."
                        rows={5}
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-400 disabled:bg-brand-500/50 text-white rounded-xl font-semibold transition-all disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send message</>}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 border-t border-dark-800/50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-dark-800 bg-dark-900/50 p-5">
                <h3 className="font-semibold text-sm mb-2">{faq.q}</h3>
                <p className="text-sm text-dark-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
