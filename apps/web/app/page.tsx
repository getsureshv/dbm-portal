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
} from 'lucide-react';
import { useState } from 'react';
import { getTradeImage } from '../lib/trade-images';

/* ------------------------------------------------------------------ */
/*  Category Data                                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
      <nav className="bg-navy">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
          <Link href="/" className="text-white text-2xl font-extrabold tracking-tight">
            DBM<span className="text-gold text-[10px] ml-1 font-normal align-super">BETA</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2 rounded-lg text-white/90 font-medium text-sm hover:text-white transition"
            >
              Log In
            </Link>
            <Link
              href="/onboarding"
              className="px-5 py-2 rounded-lg bg-gold text-navy font-semibold text-sm hover:bg-gold-dark transition"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-navy via-navy-dark to-navy-light pt-16 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-white text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-4">
            Find the Right Pro for{' '}
            <span className="text-gold">Your Home Project</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto mb-10">
            AI-powered scope generation meets a trusted network of verified
            construction professionals. Describe your project and get matched
            instantly.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row bg-white rounded-xl shadow-2xl overflow-hidden">
              <div className="flex-1 flex items-center px-4 py-3 border-b sm:border-b-0 sm:border-r border-gray-200">
                <Search size={20} className="text-gray-400 mr-3 shrink-0" />
                <input
                  type="text"
                  placeholder="What do you need help with?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full text-gray-800 placeholder:text-gray-400 outline-none text-sm"
                />
              </div>
              <div className="flex items-center px-4 py-3 sm:w-44 border-b sm:border-b-0 sm:border-r border-gray-200">
                <MapPin size={18} className="text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Zip code"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full text-gray-800 placeholder:text-gray-400 outline-none text-sm"
                />
              </div>
              <button
                onClick={handleSearch}
                className="bg-gold hover:bg-gold-dark text-navy font-bold text-sm px-8 py-3.5 transition shrink-0"
              >
                Search
              </button>
            </div>
            <p className="text-white/40 text-xs mt-3">
              Popular: Kitchen Remodel, Bathroom Renovation, Deck Building, Roofing
            </p>
          </div>
        </div>
      </section>

      {/* ── Featured Stats ─────────────────────────────────────────── */}
      <section className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-16 text-center">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-gold" />
            <span className="text-navy font-bold text-lg">500+</span>
            <span className="text-gray-500 text-sm">Verified Pros</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Star size={22} className="text-gold" />
            <span className="text-navy font-bold text-lg">4.8</span>
            <span className="text-gray-500 text-sm">Avg Rating</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div className="flex items-center gap-2">
            <CheckCircle2 size={22} className="text-gold" />
            <span className="text-navy font-bold text-lg">1,200+</span>
            <span className="text-gray-500 text-sm">Projects Completed</span>
          </div>
        </div>
      </section>

      {/* ── Browse by Category ─────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-navy text-3xl font-extrabold text-center mb-2">
            Browse Professionals by Category
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">
            Find the right expert for every phase of your project
          </p>

          <div className="space-y-12">
            {categoryGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-navy font-bold text-lg mb-4 pl-1">
                  {group.title}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {group.categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/discovery?trade=${cat.slug}`}
                      className="group bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg hover:scale-[1.03] transition-all duration-200"
                    >
                      <div className="rounded-t-lg overflow-hidden">
                        <img
                          src={getTradeImage(cat.slug)}
                          alt={cat.name}
                          className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="py-3 px-2">
                        <span className="block text-navy text-xs font-semibold text-center leading-tight">
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

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-navy text-3xl font-extrabold mb-3">
            How It Works
          </h2>
          <p className="text-gray-500 mb-14 max-w-md mx-auto">
            From project idea to hired professional in three simple steps
          </p>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                step: '1',
                icon: <MessageSquare size={28} className="text-gold" />,
                title: 'Tell Us About Your Project',
                desc: 'Describe what you need or let our AI Scope Architect interview you to generate a professional Scope of Work in minutes.',
              },
              {
                step: '2',
                icon: <Users size={28} className="text-gold" />,
                title: 'Get Matched with Top Pros',
                desc: 'Our AI matches you with verified, licensed providers who specialize in exactly what your project requires.',
              },
              {
                step: '3',
                icon: <ShieldCheck size={28} className="text-gold" />,
                title: 'Hire with Confidence',
                desc: 'Compare bids side by side, read verified reviews, and hire licensed professionals backed by our accountability platform.',
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 shadow-lg flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-navy text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Scope Architect Highlight ───────────────────────────── */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 text-gold text-xs font-bold mb-4">
              <Sparkles size={14} />
              AI-Powered
            </div>
            <h2 className="text-navy text-3xl font-extrabold mb-4">
              Meet the AI Scope Architect
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Our AI interviews you about your project and automatically generates
              a professional Scope of Work document. No more guessing what to
              include, no more back-and-forth with contractors about project
              details.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Generates professional SOW documents in minutes',
                'Covers scope, deliverables, timeline, and budget',
                'Ensures nothing is missed with guided 4-step interview',
                'Download as a polished PDF ready to share',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/onboarding?role=owner"
              className="inline-flex items-center gap-2 bg-navy hover:bg-navy-dark text-white font-semibold text-sm px-6 py-3 rounded-lg transition"
            >
              Try It Free
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="flex-1 max-w-md w-full">
            <div className="bg-navy rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-white/40 text-xs ml-2">AI Scope Architect</span>
              </div>
              <div className="space-y-3">
                <div className="bg-navy-light rounded-lg p-3">
                  <p className="text-white/50 text-xs mb-1">AI Assistant</p>
                  <p className="text-white text-sm">
                    What type of project are you planning? For example: kitchen
                    remodel, new deck, bathroom renovation...
                  </p>
                </div>
                <div className="bg-gold/10 rounded-lg p-3 ml-8">
                  <p className="text-gold text-xs mb-1">You</p>
                  <p className="text-white text-sm">
                    I want to remodel my kitchen - new cabinets, countertops,
                    and flooring.
                  </p>
                </div>
                <div className="bg-navy-light rounded-lg p-3">
                  <p className="text-white/50 text-xs mb-1">AI Assistant</p>
                  <p className="text-white text-sm">
                    Great! Let me build your scope. What is the approximate
                    square footage of your kitchen?
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-1.5 bg-navy-light rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-gold rounded-full" />
                  </div>
                  <span className="text-white/40 text-xs">33% complete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dual CTA ───────────────────────────────────────────────── */}
      <section className="bg-navy py-20 px-6">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-white text-3xl font-extrabold mb-3">
            Ready to Get Started?
          </h2>
          <p className="text-white/50 max-w-md mx-auto">
            Whether you are planning a project or growing your business, DBM has
            you covered.
          </p>
        </div>
        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-6">
          <Link
            href="/onboarding?role=owner"
            className="group bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-gold/40 hover:bg-white/10 transition-all"
          >
            <div className="w-14 h-14 rounded-xl bg-gold/15 flex items-center justify-center mb-5 group-hover:bg-gold/25 transition">
              <Home size={28} className="text-gold" />
            </div>
            <h3 className="text-white text-xl font-bold mb-2">I&apos;m a Homeowner</h3>
            <p className="text-white/50 text-sm leading-relaxed mb-4">
              Describe your project, get an AI-generated scope of work, and
              connect with verified local pros who compete for your business.
            </p>
            <span className="inline-flex items-center gap-1 text-gold text-sm font-semibold group-hover:gap-2 transition-all">
              Start Your Project <ArrowRight size={16} />
            </span>
          </Link>
          <Link
            href="/onboarding?role=provider"
            className="group bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-blue-400/40 hover:bg-white/10 transition-all"
          >
            <div className="w-14 h-14 rounded-xl bg-blue-500/15 flex items-center justify-center mb-5 group-hover:bg-blue-500/25 transition">
              <HardHat size={28} className="text-blue-400" />
            </div>
            <h3 className="text-white text-xl font-bold mb-2">I&apos;m a Professional</h3>
            <p className="text-white/50 text-sm leading-relaxed mb-4">
              Create your profile, get discovered by homeowners in your area,
              and bid on projects with detailed scopes already prepared.
            </p>
            <span className="inline-flex items-center gap-1 text-blue-400 text-sm font-semibold group-hover:gap-2 transition-all">
              Grow Your Business <ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-navy-dark py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-white/40 text-sm">
            &copy; {new Date().getFullYear()} Don&apos;t Build Meh. All rights reserved.
          </div>
          <div className="flex gap-6 text-white/40 text-sm">
            <Link href="#" className="hover:text-white/70 transition">About</Link>
            <Link href="#" className="hover:text-white/70 transition">Privacy</Link>
            <Link href="#" className="hover:text-white/70 transition">Terms</Link>
            <Link href="#" className="hover:text-white/70 transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
