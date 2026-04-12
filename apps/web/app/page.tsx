'use client';

import Link from 'next/link';
import { Home, Hammer, Shield, FileText, BarChart3, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy-dark to-navy-light">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-12 py-5">
        <div className="text-white text-3xl font-extrabold tracking-tight">
          DBM<span className="text-gold text-xs ml-1 font-normal align-super">BETA</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="px-5 py-2.5 rounded-lg border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition">
            Log In
          </Link>
          <Link href="/onboarding" className="px-5 py-2.5 rounded-lg bg-gold text-navy font-semibold text-sm hover:bg-gold-dark transition">
            Join the Network
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto text-center px-6 pt-20 pb-10">
        <div className="inline-block px-4 py-1.5 rounded-full bg-gold/15 text-gold text-sm font-semibold mb-6">
          Building with certainty from the first bid to the final punchlist
        </div>
        <h1 className="text-white text-5xl font-extrabold leading-tight tracking-tight mb-5">
          The Architecture of<br />
          <span className="text-gold">Accountability</span>
        </h1>
        <p className="text-white/60 text-lg leading-relaxed max-w-xl mx-auto mb-12">
          AI-powered scope generation, verified professionals, and full project
          lifecycle tracking — from discovery to closeout.
        </p>

        {/* Role Cards */}
        <div className="flex gap-5 justify-center max-w-2xl mx-auto mb-12">
          <Link href="/onboarding?role=owner" className="flex-1 text-left p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-gold/40 hover:bg-white/10 transition group">
            <div className="w-12 h-12 rounded-xl bg-gold/15 flex items-center justify-center mb-4 group-hover:bg-gold/25 transition">
              <Home size={24} className="text-gold" />
            </div>
            <h3 className="text-white text-lg font-bold mb-1">I am an Owner</h3>
            <p className="text-gold text-xs font-bold mb-2">Build My Project</p>
            <p className="text-white/50 text-sm leading-relaxed">
              For Homeowners and Developers looking for expert teams
            </p>
          </Link>
          <Link href="/onboarding?role=provider" className="flex-1 text-left p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-400/40 hover:bg-white/10 transition group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center mb-4 group-hover:bg-blue-500/25 transition">
              <Hammer size={24} className="text-blue-400" />
            </div>
            <h3 className="text-white text-lg font-bold mb-1">I am a Provider</h3>
            <p className="text-blue-400 text-xs font-bold mb-2">Grow My Business</p>
            <p className="text-white/50 text-sm leading-relaxed">
              For Architects, Contractors, and Material Suppliers
            </p>
          </Link>
        </div>
      </div>

      {/* Social Auth */}
      <div className="max-w-sm mx-auto px-6 pb-16">
        <div className="flex flex-col gap-3">
          <button className="flex items-center justify-center gap-3 py-3 px-6 rounded-xl bg-white font-semibold text-sm text-gray-800 hover:bg-gray-50 transition">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <button className="flex items-center justify-center gap-3 py-3 px-6 rounded-xl bg-black font-semibold text-sm text-white hover:bg-gray-900 transition">
            Continue with Apple
          </button>
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-white/15" />
            <span className="text-white/30 text-xs">or use email</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>
          <Link href="/login" className="py-3 px-6 rounded-xl border border-white/20 text-white/70 font-medium text-sm text-center hover:bg-white/5 transition">
            Sign up with Email
          </Link>
        </div>
      </div>

      {/* Features strip */}
      <div className="bg-white/5 border-t border-white/10 py-12">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { icon: <Shield className="text-gold" />, title: '500+ Verified Providers', desc: 'Licensed, insured, and rated' },
            { icon: <FileText className="text-gold" />, title: 'AI Scope Generation', desc: 'Professional SOW in minutes' },
            { icon: <BarChart3 className="text-gold" />, title: '7-Phase Tracking', desc: 'Full lifecycle accountability' },
          ].map((f, i) => (
            <div key={i}>
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mx-auto mb-3">{f.icon}</div>
              <h3 className="text-white font-bold text-sm mb-1">{f.title}</h3>
              <p className="text-white/40 text-xs">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
