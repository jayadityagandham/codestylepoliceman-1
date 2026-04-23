'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, GitBranch, LogOut, Shield, Search, Lock, Globe, Loader2, Github, X, Trash2, LayoutGrid, ChevronRight, Rocket, Settings, LifeBuoy, Bell, BookOpen, Mail, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { motion } from 'framer-motion'

interface Workspace {
  id: string
  name: string
  description: string | null
  github_repo_url: string | null
  github_repo_owner: string | null
  github_repo_name: string | null
  created_at: string
  role: string
}

interface GitHubRepo {
  id: number
  full_name: string
  name: string
  owner: string
  owner_avatar: string
  private: boolean
  html_url: string
  description: string | null
  default_branch: string
  language: string | null
  updated_at: string
}

export default function DashboardPage() {
  const { user, token, logout, loading } = useAuth()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', github_repo_owner: '', github_repo_name: '' })

  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposFetched, setReposFetched] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [showRepoPicker, setShowRepoPicker] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('workspaces')
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    emailAlerts: true,
    blockerAlerts: true,
    weeklyDigest: false,
    autoRefreshSeconds: '60',
  })

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [user, loading, router])

  useEffect(() => {
    if (!token) return
    fetch('/api/workspaces', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(({ workspaces }) => setWorkspaces(workspaces ?? []))
  }, [token])

  useEffect(() => {
    const raw = localStorage.getItem('dashboard_settings')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      setSettingsForm((prev) => ({ ...prev, ...parsed }))
    } catch {
      // Ignore malformed local preference payloads.
    }
  }, [])

  const fetchGithubRepos = async () => {
    if (!token || reposFetched) return
    setReposLoading(true)
    try {
      const res = await fetch('/api/github/repos', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setGithubRepos(data.repos ?? [])
        setReposFetched(true)
      } else {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          toast.error('GitHub token expired. Please sign out and sign back in with GitHub.')
        } else {
          toast.error(data.error || 'Could not fetch GitHub repos. Make sure you signed in with GitHub.')
        }
      }
    } catch {
      toast.error('Failed to fetch repositories')
    } finally {
      setReposLoading(false)
    }
  }

  const selectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo)
    setForm((f) => ({ ...f, github_repo_owner: repo.owner, github_repo_name: repo.name }))
    setShowRepoPicker(false)
    setRepoSearch('')
  }

  const clearSelectedRepo = () => {
    setSelectedRepo(null)
    setForm((f) => ({ ...f, github_repo_owner: '', github_repo_name: '' }))
  }

  const filteredRepos = githubRepos.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  )

  const deleteWorkspace = async (wsId: string) => {
    if (!token) return
    const backup = workspaces
    setWorkspaces((prev) => prev.filter((w) => w.id !== wsId))
    setDeletingId(null)
    try {
      const res = await fetch(`/api/workspaces/${wsId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Workspace deleted')
      } else {
        setWorkspaces(backup)
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? 'Failed to delete workspace')
      }
    } catch {
      setWorkspaces(backup)
      toast.error('Failed to delete workspace')
    }
  }

  const openWorkspace = (wsId: string) => {
    if (openingWorkspaceId) return
    setOpeningWorkspaceId(wsId)
    router.push(`/dashboard/${wsId}`)
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    localStorage.setItem('dashboard_settings', JSON.stringify(settingsForm))
    await new Promise((resolve) => setTimeout(resolve, 450))
    setSavingSettings(false)
    toast.success('Settings saved')
  }

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setCreating(true)
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        github_repo_url: form.github_repo_owner && form.github_repo_name
          ? `https://github.com/${form.github_repo_owner}/${form.github_repo_name}`
          : null,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { toast.error(data.error); return }
    setWorkspaces((prev) => [...prev, { ...data.workspace, role: 'admin' }])
    setShowCreate(false)
    setForm({ name: '', description: '', github_repo_owner: '', github_repo_name: '' })
    setSelectedRepo(null)
    setRepoSearch('')
    setShowRepoPicker(false)
    toast.success('Workspace created!')
    openWorkspace(data.workspace.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="size-8 text-slate-900 animate-spin" />
      </div>
    )
  }

  const globalTabs = [
    { id: 'workspaces', label: 'Workspaces', icon: LayoutGrid },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help Center', icon: LifeBuoy },
  ]

  const tabMeta = {
    workspaces: {
      title: 'Workspaces',
      subtitle: 'Select a workspace to view performance',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Configure notifications and dashboard behavior',
    },
    help: {
      title: 'Help Center',
      subtitle: 'Guides, FAQs, and quick support paths',
    },
  } as const

  const currentTabMeta = tabMeta[activeTab as keyof typeof tabMeta]

  return (
    <div className="flex h-screen w-full bg-[#f4f5f8] text-slate-900 overflow-hidden font-sans relative">

      {/* Premium White Sidebar */}
      <aside className="w-[280px] bg-white border-r border-slate-100 flex flex-col shrink-0 h-full overflow-hidden relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-5 shrink-0">
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => router.push('/')}>
            <div className="size-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-[0_8px_16px_rgba(15,23,42,0.2)]">
              <Shield className="size-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight tracking-tight text-slate-900">Code<br/>Policeman</h2>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 px-4">Menu</p>
            {globalTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${
                  activeTab === id 
                    ? 'bg-slate-900 text-white shadow-[0_8px_16px_rgba(15,23,42,0.15)]' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`size-4.5 ${activeTab === id ? 'text-white' : 'text-slate-400'}`} />
                  {label}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 ring-2 ring-slate-100">
              {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="bg-pink-100 text-pink-600 text-sm font-bold">{user?.name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-900 truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <button onClick={() => { logout(); router.push('/') }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-[#f4f5f8]">
        
        {/* Top Navbar */}
        <header className="h-24 pr-10 pl-8 flex items-center justify-between shrink-0 pt-4">
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight leading-none mb-1">
              {currentTabMeta.title}
            </h1>
            <p className="text-[12px] font-semibold text-slate-500">{currentTabMeta.subtitle}</p>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === 'workspaces' && (
              <div className="relative hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input placeholder="Search" className="w-72 pl-11 h-11 bg-white border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-full focus-visible:ring-2 focus-visible:ring-slate-200 text-[13px] font-bold text-slate-900 placeholder:text-slate-400" />
              </div>
            )}
            <Avatar className="size-11 ring-2 ring-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ml-2">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="bg-pink-100 text-pink-600 text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            {activeTab === 'workspaces' && workspaces.length > 0 && (
              <Button onClick={() => setShowCreate(true)} className="rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-[0_8px_16px_rgba(15,23,42,0.2)] px-7 h-11 ml-2 font-bold text-[13px]">
                <Plus className="size-4 mr-2" /> New Workspace
              </Button>
            )}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto px-8 pb-12 pt-6">
          {activeTab === 'workspaces' && (
            <>
              {/* Welcome Greeting */}
              <div className="mb-10">
                <motion.h1 
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-display font-bold tracking-tight text-slate-900"
                >
                  Welcome back, {user?.name?.split(' ')[0]} 👋
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                  className="text-slate-500 font-medium mt-2"
                >
                  Select a workspace to dive into your team's analytics and repositories.
                </motion.p>
              </div>

              {/* Workspaces Area */}
              {workspaces.length === 0 && !showCreate ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="w-full mt-6"
            >
              <div className="glass-card relative overflow-hidden rounded-[2rem] p-12 sm:p-24 text-center flex flex-col items-center justify-center">
                <div className="size-24 rounded-[2rem] bg-emerald-50 flex items-center justify-center mb-8 border border-emerald-100">
                  <Rocket className="size-12 text-emerald-500" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-4">No workspaces yet</h2>
                <p className="text-slate-500 max-w-md mx-auto mb-10 text-base leading-relaxed">
                  Create your first workspace to connect a GitHub repository, track engineering flow metrics, and monitor team health.
                </p>
                <Button 
                  onClick={() => setShowCreate(true)} 
                  size="lg" 
                  className="gap-2 bg-slate-900 text-white hover:bg-slate-800 rounded-full font-semibold px-8 h-14 shadow-xl shadow-slate-200"
                >
                  <Plus className="size-5" />
                  Create Your First Workspace
                </Button>
              </div>
            </motion.div>
              ) : (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {workspaces.map((ws, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * idx }}
                  key={ws.id}
                  onClick={() => openWorkspace(ws.id)}
                  className="glass-card group cursor-pointer p-7 flex flex-col h-full bg-white relative overflow-hidden border border-slate-100"
                >
                  {/* Hover effect gradient */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-150 opacity-0 group-hover:opacity-100" />
                  
                  {/* Card Header */}
                  <div className="relative z-10 flex items-start justify-between mb-8">
                    <div className="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all duration-300 shadow-sm">
                      <GitBranch className="size-6 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100">
                        {ws.role}
                      </span>
                      {ws.role === 'admin' && (
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          {deletingId === ws.id ? (
                            <div className="absolute top-0 right-0 flex items-center gap-1 bg-white border border-red-200 rounded-lg px-2 py-1.5 shadow-xl z-20 w-max">
                              <span className="text-[11px] text-red-600 font-bold mr-1">Delete?</span>
                              <Button size="sm" variant="destructive" className="h-6 px-3 text-[11px] rounded bg-red-600 text-white hover:bg-red-700" onClick={() => deleteWorkspace(ws.id)}>Yes</Button>
                              <Button size="sm" variant="outline" className="h-6 px-3 text-[11px] rounded bg-slate-50 border-slate-200 text-slate-600" onClick={() => setDeletingId(null)}>No</Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(ws.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="relative z-10 flex-1">
                    <h3 className="text-xl font-display font-bold text-slate-900 tracking-tight">{ws.name}</h3>
                    {ws.description && <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">{ws.description}</p>}
                  </div>

                  {/* Card Footer */}
                  <div className="relative z-10 mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
                    {ws.github_repo_owner ? (
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 truncate max-w-[85%]">
                        <Github className="size-3.5 shrink-0" />
                        <span className="truncate">{ws.github_repo_owner}/{ws.github_repo_name}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic flex items-center gap-1.5">
                        <Globe className="size-3.5" /> No repository linked
                      </div>
                    )}
                    {openingWorkspaceId === ws.id ? (
                      <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200">
                        <Loader2 className="size-3.5 animate-spin" />
                        Opening...
                      </div>
                    ) : (
                      <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white text-slate-400 transition-all duration-300 shadow-sm border border-slate-100">
                        <ChevronRight className="size-4" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
              )}
            </>
          )}

          {activeTab === 'settings' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <h2 className="text-2xl font-display font-bold tracking-tight text-slate-900">Notification Preferences</h2>
                  <p className="text-slate-500 text-sm mt-1">Choose what updates you want from this dashboard.</p>

                  <div className="mt-7 space-y-4">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                      <div>
                        <p className="font-bold text-slate-900">Email alerts</p>
                        <p className="text-sm text-slate-500">Get critical issue and blocker alerts in email.</p>
                      </div>
                      <Switch checked={settingsForm.emailAlerts} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, emailAlerts: checked }))} />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                      <div>
                        <p className="font-bold text-slate-900">Blocker notifications</p>
                        <p className="text-sm text-slate-500">Instant in-app alerts when blockers are detected.</p>
                      </div>
                      <Switch checked={settingsForm.blockerAlerts} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, blockerAlerts: checked }))} />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                      <div>
                        <p className="font-bold text-slate-900">Weekly digest</p>
                        <p className="text-sm text-slate-500">A weekly summary of throughput and health trends.</p>
                      </div>
                      <Switch checked={settingsForm.weeklyDigest} onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, weeklyDigest: checked }))} />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <h3 className="text-lg font-display font-bold text-slate-900">Dashboard Behavior</h3>
                  <p className="text-slate-500 text-sm mt-1">Control refresh cadence.</p>

                  <div className="mt-5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Auto refresh (seconds)</label>
                    <Input
                      value={settingsForm.autoRefreshSeconds}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, autoRefreshSeconds: e.target.value }))}
                      className="mt-2 h-11 rounded-xl bg-slate-50 border-slate-200"
                      placeholder="60"
                    />
                  </div>

                  <Button onClick={saveSettings} disabled={savingSettings} className="mt-6 w-full rounded-xl h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold">
                    {savingSettings ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Settings className="size-4 mr-2" />}
                    {savingSettings ? 'Saving...' : 'Save settings'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'help' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                  <BookOpen className="size-6 text-slate-700" />
                  <h3 className="mt-4 text-lg font-display font-bold text-slate-900">Quick Start Guide</h3>
                  <p className="mt-2 text-sm text-slate-500">Set up a workspace, connect GitHub, and read your first health report.</p>
                  <a href="/" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-slate-700 hover:text-slate-900">
                    Open guide <ExternalLink className="size-3.5" />
                  </a>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                  <Bell className="size-6 text-slate-700" />
                  <h3 className="mt-4 text-lg font-display font-bold text-slate-900">Alert Rules</h3>
                  <p className="mt-2 text-sm text-slate-500">Understand how blocker, inactivity, and risk alerts are generated.</p>
                  <a href="/" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-slate-700 hover:text-slate-900">
                    Learn more <ExternalLink className="size-3.5" />
                  </a>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                  <Mail className="size-6 text-slate-700" />
                  <h3 className="mt-4 text-lg font-display font-bold text-slate-900">Contact Support</h3>
                  <p className="mt-2 text-sm text-slate-500">Need help with access, data sync, or unexpected errors?</p>
                  <a href="mailto:support@codestylepoliceman.dev" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-slate-700 hover:text-slate-900">
                    Email support <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-7">
                <h2 className="text-2xl font-display font-bold tracking-tight text-slate-900">Frequently Asked Questions</h2>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="font-bold text-slate-900">Why does initial workspace load take time?</p>
                    <p className="text-sm text-slate-500 mt-1">The app aggregates commits, PRs, issues, and team signals before rendering analytics.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="font-bold text-slate-900">Can I connect a private repository?</p>
                    <p className="text-sm text-slate-500 mt-1">Yes, as long as your GitHub account has access and the OAuth token permissions are valid.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 p-4">
                    <p className="font-bold text-slate-900">How often is the dashboard refreshed?</p>
                    <p className="text-sm text-slate-500 mt-1">You can tune refresh behavior from the Settings tab and manually refresh from workspace pages.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </main>
      </div>

      {openingWorkspaceId && (
        <div className="absolute inset-0 z-50 bg-slate-950/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl px-6 py-5 flex items-center gap-3">
            <Loader2 className="size-5 text-slate-900 animate-spin" />
            <div>
              <p className="text-sm font-bold text-slate-900">Opening workspace...</p>
              <p className="text-xs text-slate-500">Fetching repository analytics</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Workspace Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 shadow-2xl !rounded-[2rem] p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="font-display text-2xl font-bold tracking-tight text-slate-900">Create Workspace</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">
              Set up a new workspace for your team project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createWorkspace} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Name <span className="text-red-500">*</span></label>
              <Input 
                required 
                value={form.name} 
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} 
                placeholder="Team Alpha Project" 
                className="bg-slate-50 border-slate-200 shadow-none focus-visible:ring-slate-900 focus-visible:border-slate-900 h-12 rounded-xl text-base px-4 text-slate-900" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
              <textarea 
                value={form.description} 
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:border-transparent resize-none transition-all"
                placeholder="Capstone project, semester 2..." 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">GitHub Repository</label>
              {selectedRepo ? (
                <div className="flex items-center gap-3 h-12 px-4 border border-emerald-200 rounded-xl bg-emerald-50">
                  <img src={selectedRepo.owner_avatar} alt="" className="size-5 rounded-full" />
                  <span className="text-sm font-bold text-emerald-900 flex-1 truncate">{selectedRepo.full_name}</span>
                  {selectedRepo.private ? <Lock className="size-3.5 text-emerald-600 shrink-0" /> : <Globe className="size-3.5 text-emerald-600 shrink-0" />}
                  <button type="button" onClick={clearSelectedRepo} className="p-1.5 bg-white rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors text-slate-400 shadow-sm border border-emerald-100">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-3 text-slate-500 font-semibold bg-slate-50 border-slate-200 hover:bg-slate-100 hover:text-slate-900 h-12 rounded-xl transition-all px-4"
                    onClick={() => { fetchGithubRepos(); setShowRepoPicker(!showRepoPicker) }}
                  >
                    <Github className="size-4 shrink-0" />
                    <span className="text-sm">Select from your GitHub repos</span>
                  </Button>

                  {showRepoPicker && (
                    <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                      <div className="p-3 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                          <Input
                            autoFocus
                            value={repoSearch}
                            onChange={(e) => setRepoSearch(e.target.value)}
                            className="pl-9 h-10 text-sm bg-white border-slate-200 shadow-sm rounded-xl focus-visible:ring-slate-900"
                            placeholder="Search repositories..."
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-56 p-2">
                        {reposLoading ? (
                          <div className="flex items-center justify-center py-8 gap-3 text-sm font-medium text-slate-500">
                            <Loader2 className="size-4 animate-spin text-slate-900" />
                            Loading repos...
                          </div>
                        ) : filteredRepos.length === 0 ? (
                          <div className="text-center py-8 text-sm font-medium text-slate-500">
                            {reposFetched ? 'No repos found' : 'Click to load repos'}
                          </div>
                        ) : (
                          filteredRepos.map((repo) => (
                            <button
                              key={repo.id}
                              type="button"
                              onClick={() => selectRepo(repo)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-left transition-colors"
                            >
                              <img src={repo.owner_avatar} alt="" className="size-6 rounded-full shrink-0 border border-slate-200" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">{repo.full_name}</div>
                                {repo.description && <div className="text-xs font-medium text-slate-500 truncate mt-0.5">{repo.description}</div>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {repo.language && <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">{repo.language}</span>}
                                {repo.private ? <Lock className="size-3.5 text-slate-400" /> : <Globe className="size-3.5 text-slate-400" />}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="pt-6 mt-4 border-t border-slate-100 flex !justify-between">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="hover:bg-slate-50 text-slate-500 font-semibold rounded-xl h-12 px-6">Cancel</Button>
              <Button type="submit" disabled={creating} className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl h-12 px-8 font-semibold shadow-lg shadow-slate-200">
                {creating ? <Loader2 className="size-5 animate-spin" /> : 'Create Workspace'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
