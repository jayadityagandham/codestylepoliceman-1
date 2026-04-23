'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import {
  Github,
  Shield,
  GitBranch,
  Activity,
  Users,
  ArrowRight,
  MessageSquare,
  BarChart3,
  Brain,
  Sparkles,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [authRedirecting, setAuthRedirecting] = useState(false)

  const startAuth = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (authRedirecting) return
    setAuthRedirecting(true)
    window.location.href = '/api/auth/github'
  }

  useEffect(() => {
    if (!loading && user) {
      setAuthRedirecting(true)
      router.push('/dashboard')
    }
  }, [user, loading, router])

  const features = [
    { icon: GitBranch, title: 'Git Tracking', desc: 'Real-time commits, PRs, and issue monitoring.' },
    { icon: BarChart3, title: 'Flow Metrics', desc: 'Cycle time, WIP limits, and throughput trends.' },
    { icon: Users, title: 'Bus Factor', desc: 'Knowledge concentration and contributor health insights.' },
    { icon: MessageSquare, title: 'Team Chat', desc: 'In-app messaging with blocker and keyword detection.' },
    { icon: Brain, title: 'AI Insights', desc: 'Context-aware suggestions for your current sprint.' },
    { icon: Activity, title: 'Health Score', desc: 'Composite engineering health with explainable factors.' },
  ]

  const steps = [
    {
      step: '01',
      title: 'Sign in',
      desc: 'Authenticate with GitHub. Workspace identity is created instantly.',
    },
    {
      step: '02',
      title: 'Connect repository',
      desc: 'Bind your repo and pull commits, PRs, issues, and collaborators.',
    },
    {
      step: '03',
      title: 'Track and improve',
      desc: 'Monitor flow, detect blockers early, and ship with confidence.',
    },
  ]

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#f8fafc,#eef2ff_52%,#f8fafc)]" />
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute -right-10 top-28 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute left-1/2 top-[46%] h-96 w-96 -translate-x-1/2 rounded-full bg-violet-200/30 blur-3xl" />
      </div>

      <motion.nav
        initial={{ y: -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur"
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 shadow-sm shadow-slate-900/20">
              <Shield className="size-4 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Code Style Policeman</span>
          </div>

          <a
            href="/api/auth/github"
            onClick={startAuth}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            {authRedirecting ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
            {authRedirecting ? 'Redirecting...' : 'Sign in'}
          </a>
        </div>
      </motion.nav>

      <main>
        <section className="relative px-6 pb-20 pt-18 md:pb-24 md:pt-24">
          <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-12 lg:items-center">
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm">
                <Sparkles className="size-3.5" />
                Next-gen engineering analytics
              </div>

              <h1 className="mt-6 text-5xl font-bold leading-[1.03] tracking-tight text-slate-950 md:text-6xl lg:text-7xl">
                Ship faster with
                <span className="block bg-[linear-gradient(120deg,#0f172a,#334155)] bg-clip-text text-transparent">
                  full engineering clarity.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
                Track commits, PRs, cycle time, blockers, and team health in one dashboard designed for modern product teams.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
                <a
                  href="/api/auth/github"
                  onClick={startAuth}
                  className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-7 text-base font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  {authRedirecting ? <Loader2 className="size-5 animate-spin" /> : <Github className="size-5" />}
                  {authRedirecting ? 'Redirecting to GitHub...' : 'Continue with GitHub'}
                  {!authRedirecting && <ArrowRight className="size-4" />}
                </a>
                <div className="space-y-0.5 text-sm text-slate-500">
                  <p>Auto-register on first sign-in</p>
                  <p>Read-only repository access</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-500" /> Zero setup database</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-500" /> Real-time team feed</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-500" /> AI-powered insights</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 22, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="lg:col-span-5"
            >
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_55px_rgba(15,23,42,0.10)]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Health score</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">87</p>
                    <p className="mt-1 text-xs text-emerald-600">+6 this week</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open blockers</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">2</p>
                    <p className="mt-1 text-xs text-slate-500">Detected from chat</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cycle time breakdown</p>
                  <div className="mt-3 space-y-2">
                    {[
                      { label: 'Coding', value: '38%', color: 'bg-emerald-500' },
                      { label: 'Review', value: '44%', color: 'bg-sky-500' },
                      { label: 'Deployment', value: '18%', color: 'bg-violet-500' },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className={`h-2 rounded-full ${item.color}`} style={{ width: item.value }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-6 py-18 md:py-22">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Everything you need to run engineering well</h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                A focused toolkit for delivery speed, quality, and team reliability.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, desc }, idx) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.45, delay: idx * 0.06 }}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-1"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-6 py-18 md:py-22">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 md:flex-row md:justify-between">
            <div className="md:w-1/3">
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-slate-900">
                Get started in
                <span className="block text-slate-500">three steps.</span>
              </h2>
              <p className="mt-4 text-lg text-slate-600">Go from sign-in to actionable team visibility in less than 2 minutes.</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3 md:w-2/3">
              {steps.map((item, idx) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-70px' }}
                  transition={{ duration: 0.45, delay: idx * 0.1 }}
                  className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-18 md:py-22">
          <div className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_16px_45px_rgba(15,23,42,0.08)] md:p-12">
            <h3 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Ready to ship with confidence?</h3>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Connect your repository, monitor delivery health, and make better engineering decisions every day.
            </p>
            <div className="mt-7">
              <a
                href="/api/auth/github"
                onClick={startAuth}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-slate-800"
              >
                {authRedirecting ? <Loader2 className="size-5 animate-spin" /> : <Github className="size-5" />}
                {authRedirecting ? 'Redirecting...' : 'Start with GitHub'}
              </a>
            </div>
          </div>
        </section>
      </main>

      {authRedirecting && (
        <div className="fixed inset-0 z-[70] bg-slate-950/25 backdrop-blur-[1.5px] flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-slate-900" />
              <div>
                <p className="text-sm font-bold text-slate-900">Connecting your account...</p>
                <p className="text-xs text-slate-500 mt-0.5">You will be redirected automatically.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-200 bg-white px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900">
              <Shield className="size-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Code Style Policeman</p>
          </div>
          <p className="text-sm text-slate-500">Built for modern engineering teams.</p>
        </div>
      </footer>
    </div>
  )
}
