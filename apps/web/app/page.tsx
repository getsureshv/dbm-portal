'use client';

import Link from 'next/link';
import {
  Search,
  MapPin,
  HardHat,
  Home,
  ArrowRight,
  Star,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  Users,
  Sparkles,
  TrendingUp,
  Quote,
} from 'lucide-react';
import { useState } from 'react';
import { getTradeImage } from '../lib/trade-images';

interface Category {
  name: string;
  slug: string;
}

interface CategoryGroup {
  title: string;
  categories: Category[];
}

const categoryGroups: CategoryGroup[] = [
  {
    title: 'Popular',
    categories: [
      { name: 'General Contractors', slug: 'general-contractors' },
      { name: 'Home Builders', slug: 'home-builders' },
      { name: 'Kitchen & Bath Remodelers', slug: 'kitchen-bath-remodelers' },
      { name: 'Architects', slug: 'architects' },
      { name: 'Interior Designers', slug: 'interior-designers' },
      { name: 'Landscape Contractors', slug: 'landscape-contractors' },
    ],
  },
  {
    title: 'Remodeling',
    categories: [
      { name: 'Siding & Exteriors', slug: 'siding-exteriors' },
      { name: 'Fireplaces', slug: 'fireplaces' },
      { name: 'Custom Countertops', slug: 'custom-countertops' },
      { name: 'Specialty Contractors', slug: 'specialty-contractors' },
      { name: 'Garage Doors', slug: 'garage-doors' },
      { name: 'Stone & Concrete', slug: 'stone-concrete' },
    ],
  },
  {
    title: 'Renovation',
    categories: [
      { name: 'Cabinets & Cabinetry', slug: 'cabinets-cabinetry' },
      { name: 'Flooring Contractors', slug: 'flooring-contractors' },
      { name: 'Carpenters', slug: 'carpenters' },
      { name: 'Painters', slug: 'painters' },
      { name: 'Window Contractors', slug: 'window-contractors' },
      { name: 'Lighting', slug: 'lighting' },
    ],
  },
  {
    title: 'Outdoor',
    categories: [
      { name: 'Decks & Patios', slug: 'decks-patios' },
      { name: 'Pool Builders', slug: 'pool-builders' },
      { name: 'Fence Contractors', slug: 'fence-contractors' },
      { name: 'Landscaping', slug: 'landscaping' },
      { name: 'Lawn Care', slug: 'lawn-care' },
      { name: 'Driveways', slug: 'driveways' },
    ],
  },
  {
    title: 'Services',
    categories: [
      { name: 'Handyman', slug: 'handyman' },
      { name: 'Movers', slug: 'movers' },
      { name: 'Roofing', slug: 'roofing' },
      { name: 'Cleaning', slug: 'cleaning' },
      { name: 'Pest Control', slug: 'pest-control' },
      { name: 'Electricians', slug: 'electricians' },
    ],
  },
];

const POPULAR_SEARCHES = [
  'Kitchen Remodel',
  'Bathroom Renovation',
  'Deck Building',
  'Roofing',
  'Solar Install',
];

const TESTIMONIALS = [
  {
    quote:
      'The AI Scope Architect saved me weeks. I described my kitchen remodel in a conversation, and it produced a 6-page SOW that contractors actually respected.',
    name: 'Priya Anand',
    role: 'Homeowner · Austin, TX',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=faces',
  },
  {
    quote:
      'I get 4–5 qualified leads a week from DBM, all with proper scopes already attached. Zero tire-kickers. It is the cleanest pipeline I have ever had.',
    name: 'Marcus Reilly',
    role: 'GC · Reilly Build Co.',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=faces',
  },
  {
    quote:
      'My architect quoted from the SOW we generated on DBM with no revisions needed. The level of detail is astonishing for a free tool.',
    name: 'Elena Castillo',
    role: 'Property Developer',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&crop=faces',
  },
];

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [zipCode, setZipCode] = useState('');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (zipCode) params.set('zip', zipCode);
    window.location.href = `/discovery?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-navy/95 backdrop-blur supports-[backdrop-filter]:bg-navy/85 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-md">
              <span className="text-navy text-lg font-black">D</span>
            </div>
            <span className="text-white text-xl font-extrabold tracking-tight">
              DBM
            </span>
            <span className="text-[10px] text-gold font-bold bg-gold/15 px-1.5 py-0.5 rounded">
              BETA
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <a
              href="#how-it-works"
              className="px-4 py-2 text-white/70 font-medium text-sm hover:text-white transition"
            >
              How It Works
            </a>
            <a
              href="#categories"
              className="px-4 py-2 text-white/70 font-medium text-sm hover:text-white transition"
            >
              Browse Pros
            </a>
            <a
              href="#ai-scope"
              className="px-4 py-2 text-white/70 font-medium text-sm hover:text-white transition"
            >
              AI Scope
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg text-white/85 font-medium text-sm hover:text-white transition"
            >
              Log In
            </Link>
            <Link
              href="/onboarding"
              className="px-4 py-2 rounded-lg bg-gold text-navy font-semibold text-sm hover:bg-gold-light transition shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-dark to-[#0a1135]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute -top-32 -right-24 w-[28rem] h-[28rem] bg-gold/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -left-24 w-[28rem] h-[28rem] bg-blue-400/10 rounded-full blur-[100px]" />

        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur mb-6">
              <Sparkles size={13} className="text-gold" />
              <span className="text-white/80 text-xs font-medium tracking-wide">
                AI-powered scope generation · 500+ verified pros
              </span>
            </div>
            <h1 className="text-white text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-6">
              Build smarter with the{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-gold">right pro</span>
                <span className="absolute inset-x-0 bottom-1 h-3 bg-gold/15 -z-0 rounded" />
              </span>
              ,<br className="hidden sm:block" /> hired with confidence.
            </h1>
            <p className="text-white/65 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Describe your project. Get a professional Scope of Work generated
              by AI. Match with verified contractors competing for your job — no
              more cold calls, no more guesswork.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden ring-1 ring-white/20">
                <div className="flex-1 flex items-center px-5 py-4 border-b sm:border-b-0 sm:border-r border-gray-200">
                  <Search size={18} className="text-gray-400 mr-3 shrink-0" />
                  <input
                    type="text"
                    placeholder="What do you need help with?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full text-gray-900 placeholder:text-gray-400 outline-none text-sm"
                  />
                </div>
                <div className="flex items-center px-5 py-4 sm:w-44 border-b sm:border-b-0 sm:border-r border-gray-200">
                  <MapPin size={16} className="text-gray-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="ZIP code"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full text-gray-900 placeholder:text-gray-400 outline-none text-sm"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="bg-gold hover:bg-gold-light text-navy font-bold text-sm px-8 py-4 transition-colors shrink-0 flex items-center justify-center gap-1.5"
                >
                  <span>Search</span>
                  <ArrowRight size={15} />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <span className="text-white/40 text-xs uppercase tracking-wider font-medium mr-1">
                  Popular:
                </span>
                {POPULAR_SEARCHES.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setSearchQuery(q);
                    }}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white text-xs transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Curve into next section */}
        <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-b from-transparent to-white/0" />
      </section>

      {/* ── Trust / Stats Strip ────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6 items-center">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-gold-dark" />
              </div>
              <div>
                <div className="text-navy font-extrabold text-2xl leading-none">
                  500+
                </div>
                <div className="text-gray-500 text-xs mt-1">Verified Pros</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <Star size={20} className="text-gold-dark" />
              </div>
              <div>
                <div className="text-navy font-extrabold text-2xl leading-none">
                  4.8<span className="text-base text-gray-400">/5</span>
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  Avg Customer Rating
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-gold-dark" />
              </div>
              <div>
                <div className="text-navy font-extrabold text-2xl leading-none">
                  1,200+
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  Projects Completed
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <TrendingUp size={20} className="text-gold-dark" />
              </div>
              <div>
                <div className="text-navy font-extrabold text-2xl leading-none">
                  $42M
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  Project Value Sourced
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-gold-dark font-semibold text-sm tracking-widest uppercase mb-3">
              The DBM Workflow
            </span>
            <h2 className="text-navy text-3xl sm:text-4xl font-extrabold mb-4">
              From idea to hired pro in three steps
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              We replace endless quote-gathering with a structured process built
              around clear scope and verified trust.
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connecting line on desktop */}
            <div
              className="hidden md:block absolute top-9 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
              aria-hidden
            />

            {[
              {
                step: '01',
                icon: <MessageSquare size={26} />,
                title: 'Describe Your Project',
                desc:
                  'Chat with our AI Scope Architect. It interviews you in plain English and drafts a professional Scope of Work — automatically.',
              },
              {
                step: '02',
                icon: <Users size={26} />,
                title: 'Get Matched with Pros',
                desc:
                  'We surface licensed, insured providers who specialize in your trade. Compare profiles, ratings, and past work side by side.',
              },
              {
                step: '03',
                icon: <ShieldCheck size={26} />,
                title: 'Hire with Confidence',
                desc:
                  'Pros bid on your scope, not their guess. You award the job, sign the contract, and track every milestone in one place.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative bg-white rounded-2xl border border-gray-100 hover:border-gold/40 hover:shadow-xl hover:shadow-navy/5 transition-all p-8 group"
              >
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5 text-gold-dark mb-6 group-hover:from-gold/25 group-hover:to-gold/10 transition-colors">
                  {item.icon}
                </div>
                <span className="absolute top-7 right-7 text-5xl font-black text-gray-100 group-hover:text-gold/20 transition-colors leading-none">
                  {item.step}
                </span>
                <h3 className="text-navy text-xl font-bold mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Scope Architect Highlight ───────────────────────────── */}
      <section
        id="ai-scope"
        className="relative overflow-hidden bg-gradient-to-br from-navy via-navy-dark to-[#0a1135] py-24 px-6"
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-1/2 right-0 w-96 h-96 -translate-y-1/2 bg-gold/10 rounded-full blur-[100px]" />

        <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/15 border border-gold/30 text-gold text-xs font-bold mb-5 backdrop-blur">
              <Sparkles size={13} />
              FLAGSHIP FEATURE
            </div>
            <h2 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight mb-5">
              Your AI Scope Architect{' '}
              <span className="text-gold">writes the SOW.</span> You stay in
              control.
            </h2>
            <p className="text-white/60 leading-relaxed mb-8 text-base">
              Stop translating your project ideas into contractor-ready
              documents. Our AI runs a structured 4-turn interview, extracts
              every detail that matters, and outputs a polished, downloadable
              PDF ready to share with bidders.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                'Generates a professional SOW in under 5 minutes',
                'Covers scope, deliverables, exclusions, timeline, budget',
                'Catches missing details before pros do — no surprises',
                'Download as a polished PDF, branded and ready to send',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-white/80"
                >
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={12} className="text-gold" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-navy font-bold text-sm px-6 py-3 rounded-lg transition shadow-lg shadow-gold/20"
              >
                Try It Free
                <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm px-6 py-3 rounded-lg transition"
              >
                See It In Action
              </a>
            </div>
          </div>

          {/* Mock chat preview */}
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-tr from-gold/30 to-transparent rounded-3xl blur-2xl opacity-50" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                </div>
                <span className="flex items-center gap-1.5 text-white/50 text-xs">
                  <Sparkles size={11} className="text-gold" />
                  Scope Architect
                </span>
              </div>
              <div className="space-y-3">
                <div className="bg-white/5 rounded-xl rounded-tl-sm p-3.5 border border-white/5 max-w-[88%]">
                  <p className="text-gold text-[11px] font-semibold uppercase tracking-wider mb-1">
                    AI Architect
                  </p>
                  <p className="text-white text-sm leading-relaxed">
                    What type of project are you planning? For example: kitchen
                    remodel, new deck, bathroom renovation…
                  </p>
                </div>
                <div className="bg-gold/10 rounded-xl rounded-tr-sm p-3.5 border border-gold/15 ml-auto max-w-[88%]">
                  <p className="text-gold text-[11px] font-semibold uppercase tracking-wider mb-1">
                    You
                  </p>
                  <p className="text-white text-sm leading-relaxed">
                    Full kitchen remodel — new cabinets, quartz countertops, and
                    hardwood flooring. Approx 240 sq ft.
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl rounded-tl-sm p-3.5 border border-white/5 max-w-[88%]">
                  <p className="text-gold text-[11px] font-semibold uppercase tracking-wider mb-1">
                    AI Architect
                  </p>
                  <p className="text-white text-sm leading-relaxed">
                    Got it. I have logged 240 sq ft, quartz countertops, and
                    hardwood flooring. Are you keeping the existing layout, or
                    moving plumbing or appliances?
                  </p>
                </div>
                <div className="pt-3 mt-1 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/50 text-xs">
                      SOW Completeness
                    </span>
                    <span className="text-gold text-xs font-bold">
                      62% complete
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all"
                      style={{ width: '62%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Browse by Category ─────────────────────────────────────── */}
      <section id="categories" className="bg-gray-50 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-dark font-semibold text-sm tracking-widest uppercase mb-3">
              Find Your Pro
            </span>
            <h2 className="text-navy text-3xl sm:text-4xl font-extrabold mb-3">
              Browse by Category
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              From foundation to finishing — every trade you need, vetted and
              ready.
            </p>
          </div>

          <div className="space-y-14">
            {categoryGroups.map((group) => (
              <div key={group.title}>
                <div className="flex items-baseline justify-between mb-5 px-1">
                  <h3 className="text-navy font-extrabold text-xl tracking-tight">
                    {group.title}
                  </h3>
                  <Link
                    href="/discovery"
                    className="text-gray-500 hover:text-navy text-xs font-semibold transition flex items-center gap-1"
                  >
                    See all <ArrowRight size={12} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {group.categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/discovery?trade=${cat.slug}`}
                      className="group bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <img
                          src={getTradeImage(cat.slug)}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-navy/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="py-3 px-3">
                        <span className="block text-navy text-xs font-bold leading-tight">
                          {cat.name}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────── */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-dark font-semibold text-sm tracking-widest uppercase mb-3">
              Real People · Real Projects
            </span>
            <h2 className="text-navy text-3xl sm:text-4xl font-extrabold mb-3">
              Loved by homeowners and pros
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Join thousands building better — together.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="relative bg-gray-50 border border-gray-100 rounded-2xl p-7 hover:border-gold/30 hover:shadow-lg transition"
              >
                <Quote
                  size={28}
                  className="text-gold/40 absolute top-5 right-5"
                />
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      fill="currentColor"
                      className="text-gold"
                    />
                  ))}
                </div>
                <blockquote className="text-navy text-sm leading-relaxed mb-6">
                  “{t.quote}”
                </blockquote>
                <figcaption className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <img
                    src={t.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white"
                  />
                  <div>
                    <div className="text-navy font-semibold text-sm">
                      {t.name}
                    </div>
                    <div className="text-gray-500 text-xs">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dual CTA ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy py-24 px-6">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-white text-3xl sm:text-4xl font-extrabold mb-3">
              Ready to get started?
            </h2>
            <p className="text-white/60 max-w-md mx-auto">
              Whether you are planning a project or growing your business — DBM
              has you covered.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <Link
              href="/onboarding"
              className="group relative bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-gold/40 hover:from-gold/5 transition-all overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-gold/0 group-hover:bg-gold/10 rounded-full blur-3xl transition-all" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gold/15 flex items-center justify-center mb-5 group-hover:bg-gold/25 transition">
                  <Home size={26} className="text-gold" />
                </div>
                <h3 className="text-white text-xl font-bold mb-2.5">
                  I&apos;m a Homeowner
                </h3>
                <p className="text-white/55 text-sm leading-relaxed mb-5">
                  Describe your project, get an AI-generated scope, and connect
                  with verified pros competing for your business.
                </p>
                <span className="inline-flex items-center gap-1.5 text-gold text-sm font-bold group-hover:gap-2.5 transition-all">
                  Start Your Project <ArrowRight size={15} />
                </span>
              </div>
            </Link>
            <Link
              href="/onboarding"
              className="group relative bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-blue-400/40 hover:from-blue-500/5 transition-all overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-400/0 group-hover:bg-blue-400/10 rounded-full blur-3xl transition-all" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center mb-5 group-hover:bg-blue-500/25 transition">
                  <HardHat size={26} className="text-blue-400" />
                </div>
                <h3 className="text-white text-xl font-bold mb-2.5">
                  I&apos;m a Professional
                </h3>
                <p className="text-white/55 text-sm leading-relaxed mb-5">
                  Build your profile, get discovered, and bid on projects with
                  detailed scopes already prepared.
                </p>
                <span className="inline-flex items-center gap-1.5 text-blue-400 text-sm font-bold group-hover:gap-2.5 transition-all">
                  Grow Your Business <ArrowRight size={15} />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-navy-dark py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
                <span className="text-navy text-base font-black">D</span>
              </div>
              <div>
                <div className="text-white font-extrabold tracking-tight">
                  DBM
                </div>
                <div className="text-white/40 text-[11px] -mt-0.5">
                  Don&apos;t Build Meh
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-white/50 text-sm">
              <Link href="#" className="hover:text-white transition">
                About
              </Link>
              <Link href="#" className="hover:text-white transition">
                Privacy
              </Link>
              <Link href="#" className="hover:text-white transition">
                Terms
              </Link>
              <Link href="#" className="hover:text-white transition">
                Contact
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 text-white/30 text-xs">
            © {new Date().getFullYear()} Don&apos;t Build Meh, Inc. All rights
            reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
