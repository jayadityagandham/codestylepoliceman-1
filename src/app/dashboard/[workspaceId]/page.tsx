'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDashboard } from '@/hooks/useDashboard'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  GitCommit, GitPullRequest, AlertTriangle, Users, Activity, Clock, TrendingUp,
  Shield, RefreshCw, Bell, GitBranch, ChevronRight, Copy, X,
  CheckCircle, AlertCircle, Info, Zap, BarChart2, BookOpen, MessageSquare,
  ChevronLeft, Search, Hash, Github, LogOut, Send, Trash2, UserMinus,
  Pencil, Mail, Calendar, Save, KeyRound, Brain, ListTodo, Target, Plus, CircleDot, Flame, Sparkles, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Filler, Tooltip as ChartTooltip, Legend, type ChartOptions,
} from 'chart.js'
import { Line as ChartLine, Bar as ChartBar } from 'react-chartjs-2'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '@/lib/supabase'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, ChartTooltip, Legend)

type Tab = 'overview' | 'commits' | 'prs' | 'issues' | 'alerts' | 'bus-factor' | 'team' | 'messages' | 'insights' | 'settings'

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30' },
}

const TYPE_COLORS: Record<string, string> = {
  feat: 'bg-emerald-500/20 text-emerald-400',
  fix: 'bg-red-500/20 text-red-400',
  refactor: 'bg-purple-500/20 text-purple-400',
  docs: 'bg-blue-500/20 text-blue-400',
  test: 'bg-cyan-500/20 text-cyan-400',
  chore: 'bg-zinc-500/20 text-zinc-400',
  style: 'bg-pink-500/20 text-pink-400',
  perf: 'bg-orange-500/20 text-orange-400',
  ci: 'bg-yellow-500/20 text-yellow-400',
  security: 'bg-red-600/20 text-red-300',
  deploy: 'bg-indigo-500/20 text-indigo-400',
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 75 ? '#a3a3a3' : score >= 50 ? '#737373' : '#525252'
  const bgGlow = ''
  const label = score >= 75 ? 'Healthy' : score >= 50 ? 'At Risk' : 'Critical'
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative size-32 rounded-full shadow-lg ${bgGlow}`}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/15" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={`${(score / 100) * 251.2} 251.2`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-foreground tracking-tight">{score}</span>
          <span className="text-[10px] text-muted-foreground font-medium">/100</span>
        </div>
      </div>
      <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color, backgroundColor: `${color}15` }}>{label}</span>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <Card className="py-0 border-border hover:border-foreground/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className="size-3.5 text-muted-foreground" />
        </div>
        <div className="text-xl font-bold text-foreground tracking-tight">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  )
}

// Force-directed graph component using canvas rendering (no external dep needed for simple version)
function ForceGraph({ nodes, links }: {
  nodes: Array<{ id: string; label: string; concentration: number; busFactor: number; val: number }>
  links: Array<{ source: string; target: string; strength?: number }>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const w = container.clientWidth
    const h = container.clientHeight
    canvas.width = w * 2
    canvas.height = h * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(2, 2)

    // Initialize positions in a loose ring so graphs feel structured immediately
    const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>()
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2
      const radius = Math.min(w, h) * 0.24
      pos.set(n.id, {
        x: w / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
        y: h / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
      })
    })

    // Smooth force simulation with more settling frames for cleaner layout
    let frame = 0
    const maxFrames = 200
    const animate = () => {
      if (frame > maxFrames) return
      frame++
      ctx.clearRect(0, 0, w, h)

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos.get(nodes[i].id)!
          const b = pos.get(nodes[j].id)!
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
          const force = 950 / (dist * dist)
          a.vx -= (dx / dist) * force
          a.vy -= (dy / dist) * force
          b.vx += (dx / dist) * force
          b.vy += (dy / dist) * force
        }
      }

      // Attraction along links
      links.forEach((l) => {
        const a = pos.get(l.source)
        const b = pos.get(l.target)
        if (!a || !b) return
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const restLength = 90 - ((l.strength ?? 0.8) * 22)
        const force = (dist - restLength) * 0.02 * (l.strength ?? 1)
        a.vx += (dx / dist) * force
        a.vy += (dy / dist) * force
        b.vx -= (dx / dist) * force
        b.vy -= (dy / dist) * force
      })

      // Center gravity
      nodes.forEach((n) => {
        const p = pos.get(n.id)!
        p.vx += (w / 2 - p.x) * 0.01
        p.vy += (h / 2 - p.y) * 0.01
      })

      // Update positions
      nodes.forEach((n) => {
        const p = pos.get(n.id)!
        p.vx *= 0.82
        p.vy *= 0.82
        p.x += p.vx
        p.y += p.vy
        p.x = Math.max(34, Math.min(w - 34, p.x))
        p.y = Math.max(34, Math.min(h - 34, p.y))
      })

      // Draw curved links with dynamic emphasis by link strength
      links.forEach((l, i) => {
        const a = pos.get(l.source)
        const b = pos.get(l.target)
        if (!a || !b) return
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
        const nx = -dy / dist
        const ny = dx / dist
        const curve = (8 + (i % 3) * 5) * (i % 2 === 0 ? 1 : -1)
        const cx = (a.x + b.x) / 2 + nx * curve
        const cy = (a.y + b.y) / 2 + ny * curve

        ctx.strokeStyle = `rgba(99,102,241,${0.12 + (l.strength ?? 0.7) * 0.22})`
        ctx.lineWidth = 0.8 + (l.strength ?? 0.7) * 1.2
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.quadraticCurveTo(cx, cy, b.x, b.y)
        ctx.stroke()
      })

      // Draw nodes with glow, ring, and higher contrast labels
      nodes.forEach((n) => {
        const p = pos.get(n.id)!
        const r = Math.max(11, Math.min(20, 10 + n.val * 0.16))
        const color = n.concentration > 90 ? '#f87171' : n.concentration > 75 ? '#facc15' : '#4ade80'

        ctx.beginPath()
        ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2)
        ctx.fillStyle = color + '18'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = color + '30'
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.stroke()

        // Label and concentration
        ctx.fillStyle = '#334155'
        ctx.font = '600 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(n.label, p.x, p.y + r + 14)
        ctx.fillStyle = color
        ctx.font = '700 9px sans-serif'
        ctx.fillText(`${n.concentration}%`, p.x, p.y + 3)
      })

      requestAnimationFrame(animate)
    }

    animate()
  }, [nodes, links])

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

export default function WorkspaceDashboard({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params)
  const { user, token, logout, setTokenAndUser } = useAuth()
  const router = useRouter()
  const { data, loading, error, refetch } = useDashboard(workspaceId)
  const [tab, setTab] = useState<Tab>('overview')
  const [wsInfo, setWsInfo] = useState<{ name: string; github_webhook_secret?: string; discord_channel_id?: string; github_repo_owner?: string; github_repo_name?: string } | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const [commitsPage, setCommitsPage] = useState(0)
  const [prsPage, setPrsPage] = useState(0)
  const [issuesPage, setIssuesPage] = useState(0)
  const [msgSearch, setMsgSearch] = useState('')
  const [msgViewFilter, setMsgViewFilter] = useState<'all' | 'blockers' | 'keywords' | 'questions'>('all')
  const [msgInput, setMsgInput] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [realtimeMessages, setRealtimeMessages] = useState<Array<{ id: string; source: string; channel_name: string; author_username: string; content: string; sent_at: string; intent: string | null; entities: Record<string, unknown> | null; is_blocker?: boolean | null }>>([])
  const pendingOptimisticIds = useRef<Set<string>>(new Set())
  const [, setTick] = useState(0)
  const PAGE_SIZE = 10

  // Tick every 30s to refresh relative timestamps ("X minutes ago")
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  // Sync messages: merge dashboard data into realtime state whenever it changes
  useEffect(() => {
    if (!data?.messages) return
    setRealtimeMessages((prev) => {
      // Merge: keep all realtime messages + add any from data that aren't already there
      const existingIds = new Set(prev.map((m) => m.id))
      const existingContents = new Set(prev.map((m) => `${m.author_username}:${m.content}:${m.sent_at?.slice(0, 16)}`))
      const newFromData = data.messages.filter((m) => {
        if (existingIds.has(m.id)) return false
        // Also skip if content+author already exists (optimistic match)
        const key = `${m.author_username}:${m.content}:${m.sent_at?.slice(0, 16)}`
        if (existingContents.has(key)) return false
        return true
      })
      if (newFromData.length === 0 && prev.length > 0) return prev
      // Sort by sent_at descending
      const merged = [...prev, ...newFromData].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      return merged
    })
  }, [data?.messages])

  // Supabase Realtime subscription for instant message updates
  useEffect(() => {
    if (!workspaceId) return

    const channel = supabase
      .channel(`messages:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'discord_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const msg = {
            id: row.id as string,
            source: row.author_discord_id === 'app' ? 'app' : 'discord',
            channel_name: (row.channel_name as string) ?? '',
            author_username: row.author_username as string,
            content: row.content as string,
            sent_at: row.sent_at as string,
            intent: (row.intent as string) ?? null,
            entities: (row.entities as Record<string, unknown>) ?? null,
            is_blocker: (row.is_blocker as boolean | null) ?? false,
          }
          setRealtimeMessages((prev) => {
            // If this exact id already exists, skip
            if (prev.some((m) => m.id === msg.id)) return prev
            // Check if there's a matching optimistic message (same content + author)
            const optIdx = prev.findIndex((m) =>
              m.id.startsWith('opt-') &&
              m.content === msg.content &&
              m.author_username === msg.author_username
            )
            if (optIdx >= 0) {
              // Replace the optimistic message with the real one
              const updated = [...prev]
              updated[optIdx] = msg
              pendingOptimisticIds.current.delete(prev[optIdx].id)
              return updated
            }
            return [msg, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'discord_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const deleted = payload.old as Record<string, unknown>
          if (deleted?.id) {
            setRealtimeMessages((prev) => prev.filter((m) => m.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId])

  // Polling fallback: fetch new messages every 3s when Messages tab is active
  // This ensures real-time delivery even if Supabase Realtime replication isn't enabled
  useEffect(() => {
    if (tab !== 'messages' || !workspaceId || !token) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const { messages: fresh } = await res.json()
        if (!fresh) return
        setRealtimeMessages((prev) => {
          const freshIds = new Set((fresh as Array<{ id: string }>).map((m) => m.id))
          // Remove messages that no longer exist on the server (deleted by admin)
          // but keep optimistic messages that haven't been confirmed yet
          const surviving = prev.filter((m) => m.id.startsWith('opt-') || freshIds.has(m.id))
          const existingIds = new Set(surviving.map((m) => m.id))
          // Also track optimistic messages by content fingerprint
          const optimisticFingerprints = new Set(
            surviving.filter((m) => m.id.startsWith('opt-')).map((m) => `${m.author_username}:${m.content}`)
          )
          let changed = surviving.length !== prev.length
          let result = surviving
          const additions: typeof prev = []
          for (const m of fresh) {
            if (existingIds.has(m.id)) continue
            // Skip if this matches an optimistic message
            const fp = `${m.author_username}:${m.content}`
            if (optimisticFingerprints.has(fp)) {
              // Replace the optimistic one with the real one
              const optIdx = result.findIndex((p) => p.id.startsWith('opt-') && `${p.author_username}:${p.content}` === fp)
              if (optIdx >= 0) {
                result = [...result]
                result[optIdx] = m
                changed = true
                continue
              }
            }
            additions.push(m)
            changed = true
          }
          if (!changed && additions.length === 0) return prev
          const merged = [...result, ...additions]
            .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
          return merged
        })
      } catch { /* silent */ }
    }

    // Initial poll immediately
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [tab, workspaceId, token])

  // Repo binding state
  const [repoBinding, setRepoBinding] = useState<{ bound: boolean; repo: { owner: string; name: string; url: string; webhook_active: boolean; default_branch: string; private: boolean } | null; collaborators: Array<{ username: string; avatar_url: string; role_name: string; permissions: Record<string,boolean> }>; collaborators_updated_at: string | null } | null>(null)
  const [repoList, setRepoList] = useState<Array<{ id: number; full_name: string; name: string; owner: string; owner_avatar: string; private: boolean; description: string | null; language: string | null; updated_at: string; permissions: { admin: boolean; push: boolean; pull: boolean } | null }>>([])
  const [repoSearch, setRepoSearch] = useState('')
  const [repoLoading, setRepoLoading] = useState(false)
  const [bindingLoading, setBindingLoading] = useState(false)
  const [heuristicsLoading, setHeuristicsLoading] = useState(false)
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [collabRefreshing, setCollabRefreshing] = useState(false)
  const [unbindLoading, setUnbindLoading] = useState(false)
  const [collabInfo, setCollabInfo] = useState<{ external_contributors: { total: number; collaborators: number; external: string[] }; author_mapping: { mapped_count: number; unmapped_authors: string[] } } | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [editingWsName, setEditingWsName] = useState(false)
  const [wsNameInput, setWsNameInput] = useState('')
  const [wsNameSaving, setWsNameSaving] = useState(false)
  const [deletingWorkspace, setDeletingWorkspace] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({ alerts: true, messages: true, heuristics: true })
  const [todos, setTodos] = useState<Array<{ id: string; title: string; description: string | null; status: string; priority: string; deadline: string | null; assigned_to: string | null; created_by: string; completed_at: string | null; created_at: string }>>([])
  const [todosLoading, setTodosLoading] = useState(false)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoDesc, setNewTodoDesc] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [newTodoDeadline, setNewTodoDeadline] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [aiProjectDesc, setAiProjectDesc] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<{ summary: string; risks: string[]; suggestions: string[]; teamDynamics: string; nextSteps: string[] } | null>(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiRetryCountdown, setAiRetryCountdown] = useState(0)
  const [commitSummary, setCommitSummary] = useState<{ summary: string; highlights: string[]; authorBreakdown: Record<string, string>; taskProgress: Array<{ taskId: string; taskTitle: string; status: 'addressed' | 'partially-addressed' | 'not-addressed'; evidence: string }>; completionPercent: number; workInsight: string; syncedTasksCount?: number } | null>(null)
  const [commitSummarizing, setCommitSummarizing] = useState(false)
  const [commitFilter, setCommitFilter] = useState<string>('all')

  // Derive admin status from members data
  const isAdmin = data?.members?.some((m) => m.user?.id === user?.id && m.role === 'admin') ?? false

  // Fetch todos when insights tab is active
  useEffect(() => {
    if (tab !== 'insights' || !token) return
    fetchTodos()
  }, [tab, token, workspaceId])

  useEffect(() => {
    if (!user) router.push('/')
  }, [user, router])

  useEffect(() => {
    if (!token) return
    fetch(`/api/workspaces/${workspaceId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(({ workspace }) => setWsInfo(workspace))
    // Fetch repo binding status
    fetch(`/api/workspaces/${workspaceId}/repo`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setRepoBinding(d))
      .catch(() => {})
    // Fetch collaborator / external contributor info
    fetch(`/api/workspaces/${workspaceId}/collaborators`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setCollabInfo(d))
      .catch(() => {})
  }, [workspaceId, token])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase.channel(`workspace-${workspaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter: `workspace_id=eq.${workspaceId}` }, () => {
        refetch()
        toast.warning('New alert detected', { description: 'Dashboard updated' })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commits', filter: `workspace_id=eq.${workspaceId}` }, () => {
        refetch()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workspaceId, refetch])

  const generateInvite = async () => {
    if (!token) return
    setInviteLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'member', expires_hours: 48 }),
      })
      const data = await res.json()
      if (res.ok) {
        setInviteUrl(data.invite_url)
        setInviteCopied(false)
        toast.success('Invite link generated (48h)')
      }
      else toast.error(data.error)
    } catch { toast.error('Failed to generate invite') }
    finally { setInviteLoading(false) }
  }

  const copyInviteLink = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setInviteCopied(true)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setInviteCopied(false), 1800)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const fetchTodos = async () => {
    if (!token) return
    setTodosLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/todos`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      if (res.ok) setTodos(d.todos ?? [])
      else toast.error(d.error || 'Failed to load tasks')
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setTodosLoading(false)
    }
  }

  const generateAiTasks = async () => {
    if (!token || aiGenerating || !aiProjectDesc.trim()) return
    setAiGenerating(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/todos/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDescription: aiProjectDesc.trim(), existingTodos: todos.map((t) => t.title) }),
      })
      const d = await res.json()
      if (res.ok) {
        toast.success(`Generated ${d.count ?? d.todos?.length ?? 0} task(s)`)
        setAiProjectDesc('')
        fetchTodos()
      } else {
        toast.error(d.error || 'Failed to generate tasks')
      }
    } catch {
      toast.error('Failed to generate tasks')
    } finally {
      setAiGenerating(false)
    }
  }

  const addTodo = async () => {
    if (!token || addingTodo || !newTodoTitle.trim()) return
    setAddingTodo(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/todos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTodoTitle.trim(),
          description: newTodoDesc.trim() || null,
          priority: newTodoPriority,
          deadline: newTodoDeadline || null,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        toast.success('Task created')
        setNewTodoTitle('')
        setNewTodoDesc('')
        setNewTodoPriority('medium')
        setNewTodoDeadline('')
        setShowAddTodo(false)
        fetchTodos()
      } else {
        toast.error(d.error || 'Failed to create task')
      }
    } catch {
      toast.error('Failed to create task')
    } finally {
      setAddingTodo(false)
    }
  }

  const updateTodoStatus = async (id: string, status: 'pending' | 'in-progress' | 'completed') => {
    if (!token) return
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/todos`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const d = await res.json()
      if (res.ok) {
        setTodos((prev) => prev.map((t) => (t.id === id ? d.todo : t)))
      } else {
        toast.error(d.error || 'Failed to update task')
      }
    } catch {
      toast.error('Failed to update task')
    }
  }

  const removeTodo = async (id: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/todos`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setTodos((prev) => prev.filter((t) => t.id !== id))
        toast.success('Task removed')
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to remove task')
      }
    } catch {
      toast.error('Failed to remove task')
    }
  }

  const resolveAlert = async (alertId: string) => {
    if (!token) return
    setResolvingAlertId(alertId)
    try {
      await fetch(`/api/workspaces/${workspaceId}/alerts`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      })
      refetch()
      toast.success('Alert resolved')
    } catch { toast.error('Failed to resolve alert') }
    finally { setResolvingAlertId(null) }
  }

  const runHeuristics = async () => {
    if (!token || heuristicsLoading) return
    setHeuristicsLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/heuristics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await res.json()
      if (res.ok) { refetch(); toast.success(`Heuristics ran: ${d.alerts_generated} alerts`) }
      else toast.error(d.error)
    } catch { toast.error('Heuristic scan failed') }
    finally { setHeuristicsLoading(false) }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'commits', label: 'Commits', icon: GitCommit },
    { id: 'prs', label: 'Pull Requests', icon: GitPullRequest },
    { id: 'issues', label: 'Issues', icon: AlertCircle },
    { id: 'alerts', label: `Alerts${data?.alerts?.length ? ` (${data.alerts.length})` : ''}`, icon: Bell },
    { id: 'bus-factor', label: 'Bus Factor', icon: BookOpen },
    { id: 'team', label: `Team${data?.teamStats?.length ? ` (${data.teamStats.length})` : ''}`, icon: Users },
    { id: 'messages', label: `Messages${realtimeMessages.length ? ` (${realtimeMessages.length})` : ''}`, icon: MessageSquare },
    { id: 'insights', label: 'AI Insights', icon: Brain },
    { id: 'settings', label: 'Settings', icon: Shield },
  ]

  // AR-VCS-013/014: Fetch the list of repos accessible to the user
  const fetchRepos = async () => {
    if (!token) return
    setRepoLoading(true)
    try {
      const res = await fetch('/api/github/repos', { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      if (res.ok) setRepoList(d.repos ?? [])
      else toast.error(d.error)
    } catch { toast.error('Failed to fetch repositories') }
    finally { setRepoLoading(false) }
  }

  // AR-VCS-015: Select and bind a repo to this workspace
  const bindRepo = async (owner: string, repo: string) => {
    if (!token) return
    setBindingLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/repo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo }),
      })
      const d = await res.json()
      if (res.ok) {
        toast.success(`Repository bound! Synced ${d.sync?.commits ?? 0} commits, ${d.sync?.pullRequests ?? 0} PRs, ${d.sync?.issues ?? 0} issues, ${d.sync?.collaborators ?? 0} collaborators`)
        // Refresh binding and dashboard
        fetch(`/api/workspaces/${workspaceId}/repo`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((b) => setRepoBinding(b))
        fetch(`/api/workspaces/${workspaceId}/collaborators`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((c) => setCollabInfo(c))
        refetch()
        setRepoList([])
      } else {
        toast.error(d.error)
      }
    } catch { toast.error('Failed to bind repository') }
    finally { setBindingLoading(false) }
  }

  // AR-VCS-028: Refresh collaborators
  const refreshCollaborators = async () => {
    if (!token) return
    setCollabRefreshing(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/collaborators`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await res.json()
      if (res.ok) {
        toast.success(`Refreshed ${d.count} collaborators`)
        fetch(`/api/workspaces/${workspaceId}/collaborators`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((c) => setCollabInfo(c))
        fetch(`/api/workspaces/${workspaceId}/repo`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json()).then((b) => setRepoBinding(b))
      } else toast.error(d.error)
    } catch { toast.error('Failed to refresh collaborators') }
    finally { setCollabRefreshing(false) }
  }

  // Unbind repo
  const unbindRepo = async () => {
    if (!token) return
    if (!confirm('This will disconnect the repository from this workspace. Historical data will remain. Continue?')) return
    setUnbindLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/repo`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Repository unbound')
        setRepoBinding({ bound: false, repo: null, collaborators: [], collaborators_updated_at: null })
        setCollabInfo(null)
      } else toast.error('Failed to unbind repo')
    } catch { toast.error('Failed to unbind repo') }
    finally { setUnbindLoading(false) }
  }

  const filteredRepos = repoList.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  )

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="size-6 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="size-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="link" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    )
  }

  const formatSeconds = (s: number | null) => {
    if (!s) return '—'
    const h = Math.floor(s / 3600)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ${h % 24}h`
    return `${h}h`
  }

  const clampPercent = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

  const recentCommits7d = data
    ? data.recentCommits.filter((c) => new Date(c.committed_at).getTime() > Date.now() - 7 * 86400000).length
    : 0
  const totalPRsForRate = data ? data.pullRequests.length : 0
  const closedOrMergedPRsForRate = data ? data.pullRequests.filter((pr) => pr.state !== 'open').length : 0
  const totalIssuesForRate = data ? data.issues.length : 0
  const resolvedIssuesForRate = data ? data.issues.filter((i) => i.state !== 'open').length : 0
  const fallbackCommitVelocity = clampPercent((recentCommits7d / 14) * 100)
  const fallbackPrThroughput = totalPRsForRate === 0 ? 0 : clampPercent((closedOrMergedPRsForRate / totalPRsForRate) * 100)
  const fallbackIssueResolution = totalIssuesForRate === 0 ? 0 : clampPercent((resolvedIssuesForRate / totalIssuesForRate) * 100)
  const fallbackActivitySpread = !data ? 0 : data.contributors.length >= 4 ? 100 : data.contributors.length >= 3 ? 80 : data.contributors.length >= 2 ? 60 : data.contributors.length >= 1 ? 30 : 0
  const contributorHealthRows = data?.contributorHealth ?? []
  const activeContributors = contributorHealthRows.filter((h) => h.status === 'active').length
  const moderateContributors = contributorHealthRows.filter((h) => h.status === 'moderate').length
  const inactiveContributors = contributorHealthRows.filter((h) => h.status === 'inactive').length
  const fallbackContributorHealth = contributorHealthRows.length === 0 ? 0 : clampPercent(((activeContributors + moderateContributors) / contributorHealthRows.length) * 100)
  const alertsLoadPercent = clampPercent((data?.alerts.length ?? 0) * 10)
  const wipLoadPercent = clampPercent((data?.overview.totalWIP ?? 0) * 12.5)
  const individualContributorActivity = contributorHealthRows
    .slice()
    .sort((a, b) => a.hours_since_last_commit - b.hours_since_last_commit)
    .slice(0, 4)
  const healthBreakdown = {
    commitVelocity: {
      score: data?.overview.healthBreakdown?.commitVelocity?.score ?? fallbackCommitVelocity,
      detail: data?.overview.healthBreakdown?.commitVelocity?.detail ?? `${recentCommits7d} commits in last 7d`,
    },
    prThroughput: {
      score: data?.overview.healthBreakdown?.prThroughput?.score ?? fallbackPrThroughput,
      detail: data?.overview.healthBreakdown?.prThroughput?.detail ?? (totalPRsForRate === 0 ? 'No PRs yet' : `${closedOrMergedPRsForRate}/${totalPRsForRate} PRs closed/merged`),
    },
    issueResolution: {
      score: data?.overview.healthBreakdown?.issueResolution?.score ?? fallbackIssueResolution,
      detail: data?.overview.healthBreakdown?.issueResolution?.detail ?? (totalIssuesForRate === 0 ? 'No issues yet' : `${resolvedIssuesForRate}/${totalIssuesForRate} issues resolved`),
    },
    activitySpread: {
      score: data?.overview.healthBreakdown?.activitySpread?.score ?? fallbackActivitySpread,
      detail: data?.overview.healthBreakdown?.activitySpread?.detail ?? `${data?.contributors.length ?? 0} contributors`,
    },
    healthDiversity: {
      score: data?.overview.healthBreakdown?.healthDiversity?.score ?? fallbackContributorHealth,
      detail: data?.overview.healthBreakdown?.healthDiversity?.detail ?? (contributorHealthRows.length === 0 ? 'No contributor health data yet' : `${activeContributors + moderateContributors}/${contributorHealthRows.length} active or moderate`),
    },
  }

  const getEntityStringList = (entities: Record<string, unknown> | null | undefined, key: string) => {
    const value = entities?.[key]
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  }

  const getNerStringList = (entities: Record<string, unknown> | null | undefined, key: string) => {
    const ner = entities?.ner
    if (!ner || typeof ner !== 'object') return []
    const value = (ner as Record<string, unknown>)[key]
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
  }

  const isBlockerMessage = (msg: { intent: string | null; entities: Record<string, unknown> | null; is_blocker?: boolean | null }) => {
    const entityBlocker = Boolean(msg.entities?.isBlocker)
    return Boolean(msg.is_blocker) || entityBlocker || msg.intent === 'blocker'
  }

  const messageKeywords = (msg: { entities: Record<string, unknown> | null }) => {
    const techTerms = getEntityStringList(msg.entities, 'techTerms')
    const issueRefs = getNerStringList(msg.entities, 'issueRefs')
    return [...new Set([...techTerms, ...issueRefs])]
  }

  const blockerMessagesCount = realtimeMessages.filter((msg) => isBlockerMessage(msg)).length
  const keywordMessagesCount = realtimeMessages.filter((msg) => messageKeywords(msg).length > 0).length

  const filteredMessages = realtimeMessages
    .filter((msg) => {
      if (msgViewFilter === 'blockers') return isBlockerMessage(msg)
      if (msgViewFilter === 'keywords') return messageKeywords(msg).length > 0
      if (msgViewFilter === 'questions') return msg.intent === 'question' || msg.content.includes('?')
      return true
    })
    .filter((msg) => {
      if (!msgSearch) return true
      const q = msgSearch.toLowerCase()
      return msg.content.toLowerCase().includes(q)
        || msg.author_username.toLowerCase().includes(q)
        || (msg.channel_name ?? '').toLowerCase().includes(q)
    })

  const getContributorAvatar = (username: string | null | undefined) => {
    if (!username || !data) return null
    const fromContributors = data.contributors.find((c) => c.username === username)?.avatar_url
    if (fromContributors) return fromContributors
    const fromTeamStats = data.teamStats?.find((m) => m.username === username)?.avatar_url ?? null
    if (fromTeamStats) return fromTeamStats
    const fromMembers = data.members.find((m) => m.user?.github_username === username)?.user?.avatar_url ?? null
    return fromMembers
  }

  const renderContributorIdentity = (
    username: string | null | undefined,
    options?: { avatarSizeClass?: string; textClassName?: string }
  ) => {
    const safeName = username ?? 'unknown'
    const avatar = getContributorAvatar(safeName)
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className={options?.avatarSizeClass ?? 'size-5'}>
          {avatar ? <AvatarImage src={avatar} /> : null}
          <AvatarFallback className="text-[9px] bg-primary/20 text-primary">{safeName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className={options?.textClassName ?? 'text-xs font-medium text-foreground truncate'}>{safeName}</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full bg-[#f4f5f8] text-slate-900 overflow-hidden font-sans relative">
      
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-pink-200/20 rounded-full blur-[100px]" />
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-emerald-200/20 rounded-full blur-[100px]" />
      </div>

      {/* Premium Sidebar */}
      <aside className="w-[280px] bg-white border-r border-slate-100 flex flex-col shrink-0 h-full overflow-hidden relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-5 shrink-0">
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => router.push('/dashboard')}>
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
            <div className="space-y-1.5">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 ${
                    tab === id 
                      ? 'bg-slate-900 text-white shadow-[0_8px_16px_rgba(15,23,42,0.15)]' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon className={`size-4.5 ${tab === id ? 'text-white' : 'text-slate-400'}`} />
                    {label}
                  </div>
                </button>
              ))}
            </div>
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
            <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-[#f4f5f8]">
        {/* Top Navbar */}
        <header className="h-24 pr-10 pl-8 flex items-center justify-between shrink-0 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex flex-col justify-center">
              <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight leading-none mb-1 flex items-center gap-3">
                {wsInfo?.name ?? 'Loading...'}
                {data?.overview && (
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                    data.overview.healthScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                    data.overview.healthScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {data.overview.healthScore >= 75 ? 'Pro' : 'Risk'}
                  </span>
                )}
              </h1>
              <p className="text-[12px] font-semibold text-slate-500">Workspace Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input placeholder="Search here..." className="w-72 pl-11 h-11 bg-white border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-full focus-visible:ring-2 focus-visible:ring-slate-200 text-[13px] font-bold text-slate-900 placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={runHeuristics} disabled={heuristicsLoading} className="rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent hover:bg-slate-50 size-11">
                    {heuristicsLoading ? <Loader2 className="size-4 animate-spin text-slate-500" /> : <Zap className="size-4.5 text-slate-600" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Run heuristics</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={refetch} disabled={loading} className="rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent hover:bg-slate-50 size-11">
                    <RefreshCw className={`size-4.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)} className="rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-[0_8px_16px_rgba(15,23,42,0.2)] px-6 h-11 ml-2 font-bold text-[13px]">
              <UserMinus className="size-4 mr-2" /> Invite
            </Button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main ref={dashboardRef} className="flex-1 overflow-y-auto px-8 pb-12 pt-6">

        {/* OVERVIEW TAB */}
        {tab === 'overview' && data && (
          <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto py-2">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-[28px] font-display font-bold text-slate-900 tracking-tight">Overview</h2>
                <p className="text-[13px] text-slate-500 mt-1 font-medium">Uncompromising Performance Metrics & Code Health</p>
              </div>
              <div className="flex items-center gap-3 bg-white p-1 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <button className="px-5 py-2 text-[13px] font-bold rounded-full bg-slate-900 text-white shadow-md">All Time</button>
                <button className="px-5 py-2 text-[13px] font-bold rounded-full text-slate-500 hover:text-slate-900 transition-colors">Last 7 Days</button>
                <button className="px-5 py-2 text-[13px] font-bold rounded-full text-slate-500 hover:text-slate-900 transition-colors">Last 30 Days</button>
              </div>
            </div>

            {/* Teams Section */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 px-1">Teams & Activity</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main Large Card */}
                <Card className="lg:col-span-2 border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white p-2">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <h4 className="text-4xl font-display font-bold text-slate-900 tracking-tight">
                          {data.overview.totalCommits.toLocaleString()}
                        </h4>
                        <p className="text-[12px] text-slate-400 font-semibold mt-1">Total Commits Over Time</p>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-full">
                        <TrendingUp className="size-3.5" />
                        <span className="text-[12px] font-bold">{data.overview.healthScore}% Health</span>
                      </div>
                    </div>

                    {/* Gradient Bar (Time Tracking Equivalent) */}
                    <div className="flex items-center gap-4 mb-8 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      <div className="text-[12px] font-bold text-slate-700 px-2 whitespace-nowrap">Commit Velocity</div>
                       <div className="flex-1 h-4 rounded-full bg-slate-100 shadow-inner relative overflow-hidden">
                         <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-400 via-orange-400 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${healthBreakdown.commitVelocity.score}%` }} />
                      </div>
                       <div className="text-[12px] font-bold text-slate-900 px-2 whitespace-nowrap">{healthBreakdown.commitVelocity.score}%</div>
                    </div>

                    {/* Trends Over Time Chart */}
                    <div>
                      <h5 className="text-[15px] font-bold text-slate-900 mb-4">Trends Over Time</h5>
                      <div className="h-[200px]">
                        {data.healthHistory.length > 0 ? (
                          <ChartBar
                            data={{
                              labels: [...data.healthHistory].reverse().map((h) => new Date(h.snapshot_at).toLocaleDateString()),
                              datasets: [{
                                label: 'Health Score',
                                data: [...data.healthHistory].reverse().map((h) => h.score),
                                backgroundColor: 'rgba(52, 211, 153, 0.4)', // emerald-400 with opacity
                                hoverBackgroundColor: 'rgba(52, 211, 153, 0.8)',
                                borderRadius: 4,
                                barPercentage: 0.6,
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: { legend: { display: false } },
                              scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 10, weight: 600 }, color: '#94a3b8' } },
                                y: { display: false }
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <Activity className="size-8 mb-2 opacity-20" />
                            <span className="text-[12px] font-semibold">No trend data available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Best Performing Employees Card */}
                <Card className="border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white p-2">
                  <CardContent className="p-6">
                    <h4 className="text-[15px] font-bold text-slate-900 mb-6">Top Contributors</h4>
                    {data.contributors.length === 0 ? (
                      <p className="text-[12px] text-slate-400 text-center py-8">No contributors yet.</p>
                    ) : (
                      <div className="space-y-5">
                        {data.contributors.slice(0, 6).map((c, i) => (
                          <div key={c.username} className="flex items-center gap-3">
                            <div className="relative">
                              {c.avatar_url ? (
                                <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full shadow-sm" />
                              ) : (
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center shadow-sm">
                                  <span className="text-[14px] font-bold text-slate-600">{c.username.charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                              {i < 3 && (
                                <div className={`absolute -bottom-1 -right-1 size-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-400'}`}>
                                  {i + 1}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-900 truncate">{c.username}</p>
                              <p className="text-[11px] text-slate-400 truncate">{c.commits} commits</p>
                            </div>
                            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                              <span className="text-yellow-400 text-[10px]">★</span>
                              <span className="text-[11px] font-bold text-slate-700">{Math.min(5.0, (c.commits / Math.max(1, data.contributors[0].commits)) * 5).toFixed(1)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Metrics Section */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 px-1">Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Total Commits</p>
                      <div className="p-1.5 bg-slate-50 rounded-xl text-slate-600"><GitCommit className="size-4" /></div>
                    </div>
                    <div>
                      <span className="text-3xl font-display font-bold text-slate-900">{data.overview.totalCommits.toLocaleString()}</span>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Webhook Ingested</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Open Pull Requests</p>
                      <div className="p-1.5 bg-blue-50 rounded-xl text-blue-500"><GitPullRequest className="size-4" /></div>
                    </div>
                    <div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-display font-bold text-slate-900">{data.overview.openPRs}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Active PRs</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${healthBreakdown.prThroughput.score}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{healthBreakdown.prThroughput.score}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Open Issues</p>
                      <div className="p-1.5 bg-red-50 rounded-xl text-red-500"><AlertCircle className="size-4" /></div>
                    </div>
                    <div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-display font-bold text-slate-900">{data.overview.openIssues}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Backlog Items</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${healthBreakdown.issueResolution.score}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{healthBreakdown.issueResolution.score}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Active Alerts</p>
                      <div className="p-1.5 bg-yellow-50 rounded-xl text-yellow-600"><Bell className="size-4" /></div>
                    </div>
                    <div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-display font-bold text-slate-900">{data.alerts.length.toString().padStart(2, '0')}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Unresolved</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${alertsLoadPercent}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{alertsLoadPercent}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">WIP Count</p>
                      <div className="p-1.5 bg-emerald-50 rounded-xl text-emerald-500"><Activity className="size-4" /></div>
                    </div>
                    <div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-display font-bold text-slate-900">{(data.overview.totalWIP ?? 0).toString().padStart(2, '0')}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Active Work In Progress</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${wipLoadPercent}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{wipLoadPercent}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Avg Cycle Time</p>
                      <div className="p-1.5 bg-indigo-50 rounded-xl text-indigo-500"><Clock className="size-4" /></div>
                    </div>
                    <div>
                      <span className="text-3xl font-display font-bold text-slate-900">{formatSeconds(data.overview.avgCycleTimeSeconds)}</span>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Webhook Cycle Metrics</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Commit Velocity</p>
                      <div className="p-1.5 bg-pink-50 rounded-xl text-pink-500"><TrendingUp className="size-4" /></div>
                    </div>
                    <div>
                      <span className="text-3xl font-display font-bold text-slate-900">{healthBreakdown.commitVelocity.score}%</span>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">{healthBreakdown.commitVelocity.detail}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">PR Throughput</p>
                      <div className="p-1.5 bg-blue-50 rounded-xl text-blue-500"><GitPullRequest className="size-4" /></div>
                    </div>
                    <div>
                      <span className="text-3xl font-display font-bold text-slate-900">{healthBreakdown.prThroughput.score}%</span>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">{healthBreakdown.prThroughput.detail}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Issue Resolution</p>
                      <div className="p-1.5 bg-red-50 rounded-xl text-red-500"><AlertCircle className="size-4" /></div>
                    </div>
                    <div>
                      <span className="text-3xl font-display font-bold text-slate-900">{healthBreakdown.issueResolution.score}%</span>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">{healthBreakdown.issueResolution.detail}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Activity Spread</p>
                      <div className="p-1.5 bg-emerald-50 rounded-xl text-emerald-500"><Users className="size-4" /></div>
                    </div>
                    <div>
                      <span className="text-3xl font-display font-bold text-slate-900">{healthBreakdown.activitySpread.score}%</span>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">{healthBreakdown.activitySpread.detail}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_8px_28px_rgba(0,0,0,0.05)] rounded-[1.75rem] bg-white md:col-span-2 xl:col-span-2">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-5">
                    <div className="flex items-center justify-between">
                      <p className="text-[18px] font-display font-bold text-slate-800">Contributor Health</p>
                      <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><Shield className="size-5" /></div>
                    </div>
                    <div>
                      <span className="text-5xl font-display font-bold text-slate-900">{healthBreakdown.healthDiversity.score}%</span>
                      <p className="text-[13px] text-slate-500 mt-1 font-semibold">{activeContributors + moderateContributors}/{contributorHealthRows.length} active contributors</p>
                      <p className="text-[11px] text-slate-400 mt-2 uppercase tracking-wider font-semibold">{healthBreakdown.healthDiversity.detail}</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${healthBreakdown.healthDiversity.score}%` }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-[0_8px_28px_rgba(0,0,0,0.05)] rounded-[1.75rem] bg-white md:col-span-2 xl:col-span-3">
                  <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[18px] font-display font-bold text-slate-800">Contributor Activity</p>
                      <div className="p-2 bg-slate-100 rounded-xl text-slate-600"><Activity className="size-5" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center"><p className="text-xs text-slate-500">Active</p><p className="text-lg font-bold text-emerald-600">{activeContributors}</p></div>
                      <div className="rounded-xl bg-yellow-50 px-3 py-2 text-center"><p className="text-xs text-slate-500">Moderate</p><p className="text-lg font-bold text-yellow-700">{moderateContributors}</p></div>
                      <div className="rounded-xl bg-red-50 px-3 py-2 text-center"><p className="text-xs text-slate-500">Inactive</p><p className="text-lg font-bold text-red-600">{inactiveContributors}</p></div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Individual Activity</p>
                      {individualContributorActivity.length === 0 ? (
                        <p className="text-sm text-slate-500">No contributor activity data yet.</p>
                      ) : (
                        individualContributorActivity.map((person) => {
                          const hours = Math.round(person.hours_since_last_commit)
                          const ageLabel = hours < 24 ? `${hours}h` : hours < 24 * 30 ? `${Math.round(hours / 24)}d` : '>30d'
                          return (
                          <div key={person.author} className="flex items-center justify-between gap-2 py-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              {person.avatar_url ? (
                                <img src={person.avatar_url} alt="" className="w-8 h-8 rounded-full shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                                  {person.author?.[0]?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm font-semibold text-slate-700 truncate">{person.author}</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              person.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                              person.status === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {person.status} · {ageLabel}
                            </span>
                          </div>
                          )
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>

          </div>
        )}

        {tab === 'commits' && data && (
          <Card className="py-0 shadow-sm border-border/50 overflow-hidden">
            <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Recent Commits</h2>
                  {commitFilter === 'all' ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{data.recentCommits.length} commits ingested via GitHub webhook</p>
                  ) : (
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{data.recentCommits.filter((c) => c.author_github_username === commitFilter).length} commits by</span>
                      {renderContributorIdentity(commitFilter, { avatarSizeClass: 'size-4', textClassName: 'text-xs font-medium text-muted-foreground' })}
                    </div>
                  )}
                </div>
                {data.recentCommits.length > 0 && (() => {
                  const authors = Array.from(new Set(data.recentCommits.map((c) => c.author_github_username).filter(Boolean))) as string[]
                  return authors.length > 1 ? (
                    <div className="relative">
                      <select
                        value={commitFilter}
                        onChange={(e) => { setCommitFilter(e.target.value); setCommitsPage(0) }}
                        className="appearance-none pl-4 pr-9 h-10 min-w-[210px] text-sm font-semibold bg-white border border-slate-200 rounded-2xl text-slate-800 shadow-[0_2px_10px_rgba(15,23,42,0.06)] focus:outline-none focus:ring-2 focus:ring-slate-300"
                      >
                        <option value="all">All Contributors</option>
                        {authors.sort().map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                      <ChevronRight className="pointer-events-none size-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 rotate-90" />
                    </div>
                  ) : null
                })()}
              </div>
              {data.recentCommits.length > 0 && (
                <button
                  onClick={async () => {
                    if (commitSummarizing || !token) return
                    setCommitSummarizing(true)
                    setCommitSummary(null)
                    try {
                      const res = await fetch(`/api/workspaces/${workspaceId}/commits/summarize`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      })
                      const d = await res.json()
                      if (res.ok) {
                        setCommitSummary(d)
                        fetchTodos()
                      } else {
                        toast.error(d.error || 'Failed to summarize commits')
                      }
                    } catch { toast.error('Commit summarization failed') }
                    finally { setCommitSummarizing(false) }
                  }}
                  disabled={commitSummarizing}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {commitSummarizing ? (
                    <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Summarizing...</>
                  ) : (
                    <><Sparkles className="size-3" /> Analyze Progress</>
                  )}
                </button>
              )}
            </div>

            {/* AI Commit + Task Progress Analysis */}
            {commitSummary && (
              <div className="px-5 py-5 border-b border-border bg-muted/20 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="size-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">AI Progress Analysis</span>
                    {(commitSummary.syncedTasksCount ?? 0) > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                        Synced {commitSummary.syncedTasksCount} task{(commitSummary.syncedTasksCount ?? 0) === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setCommitSummary(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>

                {/* Completion percentage */}
                <div className="bg-background rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">Work Completion</span>
                    <span className="text-lg font-bold text-foreground">{commitSummary.completionPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-foreground"
                      style={{ width: `${commitSummary.completionPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{commitSummary.workInsight}</p>
                </div>

                <div className="bg-white rounded-xl border border-border p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Executive Summary</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{commitSummary.summary}</p>
                </div>

                {/* Task progress mapping */}
                {commitSummary.taskProgress.length > 0 && (
                  <div className="bg-white rounded-xl border border-border p-4">
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Task Progress From Commits</span>
                    <div className="mt-3 space-y-2">
                      {commitSummary.taskProgress.map((tp, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg p-2.5">
                          <span className={`mt-0.5 shrink-0 size-2 rounded-full ${
                            tp.status === 'addressed' ? 'bg-foreground' :
                            tp.status === 'partially-addressed' ? 'bg-muted-foreground' : 'bg-muted'
                          }`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground truncate">{tp.taskTitle}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                tp.status === 'addressed' ? 'bg-foreground/10 text-foreground' :
                                tp.status === 'partially-addressed' ? 'bg-muted-foreground/20 text-muted-foreground' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {tp.status === 'addressed' ? 'Done' : tp.status === 'partially-addressed' ? 'In Progress' : 'Not Started'}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{tp.evidence}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {commitSummary.highlights.length > 0 && (
                  <div className="bg-white rounded-xl border border-border p-4">
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Highlights</span>
                    <ul className="mt-2 space-y-1">
                      {commitSummary.highlights.map((h, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-foreground mt-0.5">•</span> {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Object.keys(commitSummary.authorBreakdown).length > 0 && (
                  <div className="bg-white rounded-xl border border-border p-4">
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">By Author</span>
                    <div className="mt-2 space-y-1">
                      {Object.entries(commitSummary.authorBreakdown).map(([author, desc]) => (
                        <div key={author} className="text-xs text-muted-foreground flex items-start gap-2">
                          <div className="shrink-0 mt-0.5">{renderContributorIdentity(author, { avatarSizeClass: 'size-4', textClassName: 'text-xs font-medium text-foreground' })}</div>
                          <span className="text-muted-foreground">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>
            )}
            {data.recentCommits.length === 0 ? (
              <div className="py-16 text-center">
                <GitCommit className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No commits yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Configure a GitHub webhook to start ingesting commits.</p>
              </div>
            ) : (
              (() => {
                const filteredCommits = commitFilter === 'all' ? data.recentCommits : data.recentCommits.filter((c) => c.author_github_username === commitFilter)
                return (
                  <>
                    <div className="divide-y divide-border">
                      {filteredCommits.slice(commitsPage * PAGE_SIZE, (commitsPage + 1) * PAGE_SIZE).map((c, i) => (
                        <div key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                          <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLORS[c.commit_type ?? 'chore'] ?? TYPE_COLORS.chore}`}>
                            {c.commit_type ?? 'chore'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {c.author_avatar ? (
                                <Avatar className="size-5">
                                  <AvatarImage src={c.author_avatar} />
                                  <AvatarFallback className="text-[9px]">{(c.author_github_username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              ) : (
                                <Avatar className="size-5">
                                  <AvatarFallback className="text-[9px] bg-primary/20 text-primary">{(c.author_github_username ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                              )}
                              <span className="text-xs font-medium text-foreground">{c.author_github_username ?? 'unknown'}</span>
                            </div>
                            {c.message && (
                              <p className="text-xs text-muted-foreground mt-1 truncate ml-7">{c.message.split('\n')[0]}</p>
                            )}
                          </div>
                          {(c.lines_added > 0 || c.lines_deleted > 0) && (
                            <>
                              <div className="text-xs text-emerald-400">+{c.lines_added}</div>
                              <div className="text-xs text-red-400">-{c.lines_deleted}</div>
                            </>
                          )}
                          <div className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(c.committed_at), { addSuffix: true })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {filteredCommits.length > PAGE_SIZE && (
                      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {commitsPage * PAGE_SIZE + 1}-{Math.min((commitsPage + 1) * PAGE_SIZE, filteredCommits.length)} of {filteredCommits.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setCommitsPage(Math.max(0, commitsPage - 1))} disabled={commitsPage === 0}>
                            <ChevronLeft className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setCommitsPage(Math.min(Math.ceil(filteredCommits.length / PAGE_SIZE) - 1, commitsPage + 1))}
                            disabled={(commitsPage + 1) * PAGE_SIZE >= filteredCommits.length}>
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()
            )}
            </CardContent>
          </Card>
        )}

        {/* PRs TAB */}
        {tab === 'prs' && data && (
          <Card className="py-0 shadow-sm border-border/50 overflow-hidden">
            <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Pull Requests ({data.pullRequests.length})</h2>
            </div>
            {data.pullRequests.length === 0 ? (
              <div className="py-16 text-center">
                <GitPullRequest className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No pull requests tracked yet.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {data.pullRequests.slice(prsPage * PAGE_SIZE, (prsPage + 1) * PAGE_SIZE).map((pr) => {
                    const cycleInfo = data.cycleTimeTrend?.find((c) => c.pullRequestId === pr.id)
                    return (
                      <div key={pr.id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={pr.merged_at ? 'secondary' : pr.state === 'open' ? 'default' : 'outline'} className={`text-[10px] ${pr.merged_at ? 'bg-purple-400/20 text-purple-400 hover:bg-purple-400/20' : pr.state === 'open' ? 'bg-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20' : ''}`}>
                                {pr.merged_at ? 'merged' : pr.state}
                              </Badge>
                              <span className="text-xs text-muted-foreground">#{pr.github_pr_number}</span>
                            </div>
                            <p className="text-sm font-medium text-foreground truncate">{pr.title}</p>
                            <div className="mt-1 flex items-center gap-2">
                              {renderContributorIdentity(pr.author_github_username, { avatarSizeClass: 'size-4', textClassName: 'text-xs font-medium text-muted-foreground truncate' })}
                              <span className="text-xs text-muted-foreground">· {formatDistanceToNow(new Date(pr.opened_at), { addSuffix: true })}</span>
                            </div>
                            {cycleInfo && (
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {cycleInfo.codingTime != null && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10">Coding {formatSeconds(cycleInfo.codingTime)}</Badge>}
                                {cycleInfo.pickupTime != null && <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/10">Pickup {formatSeconds(cycleInfo.pickupTime)}</Badge>}
                                {cycleInfo.reviewTime != null && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/10">Review {formatSeconds(cycleInfo.reviewTime)}</Badge>}
                                {cycleInfo.deploymentTime != null && <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/10">Deploy {formatSeconds(cycleInfo.deploymentTime)}</Badge>}
                                {cycleInfo.totalCycleTime != null && <Badge variant="outline" className="text-[10px] bg-zinc-500/10 text-zinc-300 border-zinc-500/20 hover:bg-zinc-500/10">Total {formatSeconds(cycleInfo.totalCycleTime)}</Badge>}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-emerald-400">+{pr.lines_added}</p>
                            <p className="text-xs text-red-400">-{pr.lines_deleted}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {data.pullRequests.length > PAGE_SIZE && (
                  <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {prsPage * PAGE_SIZE + 1}-{Math.min((prsPage + 1) * PAGE_SIZE, data.pullRequests.length)} of {data.pullRequests.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setPrsPage(Math.max(0, prsPage - 1))} disabled={prsPage === 0}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setPrsPage(Math.min(Math.ceil(data.pullRequests.length / PAGE_SIZE) - 1, prsPage + 1))}
                        disabled={(prsPage + 1) * PAGE_SIZE >= data.pullRequests.length}>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            </CardContent>
          </Card>
        )}

        {/* ISSUES TAB */}
        {tab === 'issues' && data && (
          <Card className="py-0 shadow-sm border-border/50 overflow-hidden">
            <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Issues ({data.issues.length})</h2>
            </div>
            {data.issues.length === 0 ? (
              <div className="py-16 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No issues tracked yet.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {data.issues.slice(issuesPage * PAGE_SIZE, (issuesPage + 1) * PAGE_SIZE).map((issue) => (
                    <div key={issue.github_issue_number} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={`text-[10px] ${issue.state === 'open' ? 'bg-red-400/20 text-red-400 border-red-400/30 hover:bg-red-400/20' : 'bg-zinc-400/20 text-zinc-400 border-zinc-400/30 hover:bg-zinc-400/20'}`}>
                              {issue.state}
                            </Badge>
                            <span className="text-xs text-muted-foreground">#{issue.github_issue_number}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
                          {issue.assignee_github_username && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>Assigned to</span>
                              {renderContributorIdentity(issue.assignee_github_username, { avatarSizeClass: 'size-4', textClassName: 'text-xs font-medium text-muted-foreground truncate' })}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(issue.opened_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {data.issues.length > PAGE_SIZE && (
                  <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {issuesPage * PAGE_SIZE + 1}-{Math.min((issuesPage + 1) * PAGE_SIZE, data.issues.length)} of {data.issues.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setIssuesPage(Math.max(0, issuesPage - 1))} disabled={issuesPage === 0}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setIssuesPage(Math.min(Math.ceil(data.issues.length / PAGE_SIZE) - 1, issuesPage + 1))}
                        disabled={(issuesPage + 1) * PAGE_SIZE >= data.issues.length}>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            </CardContent>
          </Card>
        )}

        {/* ALERTS TAB */}
        {tab === 'alerts' && data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{data.alerts.length} Active Alert{data.alerts.length !== 1 ? 's' : ''}</h2>
              <Button variant="ghost" size="sm" onClick={runHeuristics} disabled={heuristicsLoading} className="text-xs gap-1.5">
                {heuristicsLoading ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Zap className="w-3 h-3" />}
                {heuristicsLoading ? 'Scanning...' : 'Run checks now'}
              </Button>
            </div>
            {data.alerts.length === 0 ? (
              <Card className="py-0 shadow-sm border-border/50">
                <CardContent className="py-16 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm text-foreground font-medium">All clear!</p>
                <p className="text-xs text-muted-foreground mt-1">No active alerts. Team is on track.</p>
                </CardContent>
              </Card>
            ) : (
              data.alerts.map((alert) => {
                const cfg = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info
                const Icon = cfg.icon
                return (
                  <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.bg}`}>
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</p>
                    </div>
                    <button onClick={() => resolveAlert(alert.id)} disabled={resolvingAlertId === alert.id} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded shrink-0 disabled:opacity-50" title="Resolve">
                      {resolvingAlertId === alert.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <X className="w-4 h-4" />}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* BUS FACTOR TAB */}
        {tab === 'bus-factor' && data && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Knowledge Distribution</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.criticalFiles.some(f => f.file.startsWith('@'))
                  ? 'Contributor commit concentration — how dependent is the project on individual contributors?'
                  : 'Files with high concentration (single-author risk)'}
              </p>
            </div>

            {/* Codebase bus factor summary */}
            {(data.codebaseBusFactor !== undefined || data.contributors.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="py-0 shadow-sm border-border/50">
                  <CardContent className="p-5 text-center">
                  <p className={`text-3xl font-bold ${(data.codebaseBusFactor ?? 0) <= 1 ? 'text-red-400' : (data.codebaseBusFactor ?? 0) <= 2 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {data.codebaseBusFactor ?? '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Codebase Bus Factor</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Contributors needed to cover 50% of commits</p>
                  </CardContent>
                </Card>
                <Card className="py-0 shadow-sm border-border/50">
                  <CardContent className="p-5 text-center">
                  <p className="text-3xl font-bold text-foreground">{data.contributors.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Total Contributors</p>
                  </CardContent>
                </Card>
                <Card className="py-0 shadow-sm border-border/50">
                  <CardContent className="p-5 text-center">
                  <p className="text-3xl font-bold text-foreground">{data.criticalFiles.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">
                    {data.criticalFiles.some(f => f.file.startsWith('@')) ? 'High-Concentration Contributors' : 'At-Risk Files'}
                  </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {data.criticalFiles.length === 0 ? (
              <Card className="py-0 shadow-sm border-border/50">
                <CardContent className="py-16 text-center">
                <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No concentration risks detected</p>
                <p className="text-xs text-muted-foreground mt-1">Knowledge appears well-distributed, or bind a GitHub repo to see analysis.</p>
                </CardContent>
              </Card>
            ) : data.criticalFiles.some(f => f.file.startsWith('@')) ? (
              /* Contributor-level bus factor (live fallback) */
              <Card className="py-0 shadow-sm border-border/50 overflow-hidden">
                <CardContent className="p-0">
                <div className="px-5 py-3.5 border-b border-border grid grid-cols-12 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  <span className="col-span-5">Contributor</span>
                  <span className="col-span-4">Commit Share</span>
                  <span className="col-span-3 text-right">Concentration</span>
                </div>
                <div className="divide-y divide-border">
                  {data.criticalFiles.map((f) => (
                    <div key={f.file} className="px-5 py-3 grid grid-cols-12 items-center gap-2 hover:bg-muted/30 transition-colors">
                      <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                        {(() => {
                          const contributor = data.contributors.find(c => c.username === f.dominant_author)
                          return contributor?.avatar_url ? (
                            <img src={contributor.avatar_url} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                              {f.dominant_author?.[0]?.toUpperCase()}
                            </div>
                          )
                        })()}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{f.dominant_author}</p>
                          <p className="text-[10px] text-muted-foreground">{f.authorCount} total contributors</p>
                        </div>
                      </div>
                      <div className="col-span-4">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${f.concentration > 60 ? 'bg-red-400' : f.concentration > 40 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                            style={{ width: `${f.concentration}%` }}
                          />
                        </div>
                      </div>
                      <div className="col-span-3 text-right">
                        <span className={`text-xs font-semibold ${f.concentration > 60 ? 'text-red-400' : f.concentration > 40 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                          {f.concentration}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                </CardContent>
              </Card>
            ) : (
              /* Per-file bus factor (from file_authorship) */
              <Card className="py-0 shadow-sm border-border/50 overflow-hidden">
                <CardContent className="p-0">
                <div className="px-5 py-3.5 border-b border-border grid grid-cols-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  <span className="col-span-2">File</span>
                  <span>Dominant Author</span>
                  <span className="text-right">Concentration</span>
                </div>
                <div className="divide-y divide-border">
                  {data.criticalFiles.map((f) => (
                    <div key={f.file} className="px-5 py-3 grid grid-cols-4 items-center gap-2 hover:bg-muted/30 transition-colors">
                      <div className="col-span-2 min-w-0">
                        <p className="text-xs font-mono text-foreground truncate">{f.file}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{f.authorCount} author{f.authorCount !== 1 ? 's' : ''} · bus factor {f.busFactor}</p>
                      </div>
                      <div className="min-w-0">{renderContributorIdentity(f.dominant_author, { avatarSizeClass: 'size-4', textClassName: 'text-xs text-muted-foreground truncate' })}</div>
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${f.concentration > 90 ? 'bg-red-400' : f.concentration > 75 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                              style={{ width: `${f.concentration}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${f.concentration > 90 ? 'text-red-400' : f.concentration > 75 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            {f.concentration}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                </CardContent>
              </Card>
            )}

            {/* Force-directed dependency graph */}
            {data.criticalFiles.length > 0 && (
              <Card className="py-0 shadow-sm border-border/50">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" /> Dependency Risk Map (Force Graph)
                </p>
                {(() => {
                  // Build graph data with stronger relationship links so the map remains readable and expressive
                  const nodes = data.criticalFiles.slice(0, 20).map((f) => ({
                    id: f.file,
                    label: f.file.startsWith('@') ? f.file.replace('@', '') : (f.file.split('/').pop() ?? f.file),
                    concentration: f.concentration,
                    busFactor: f.busFactor,
                    dominant: f.dominant_author,
                    val: Math.max(1, 100 - f.busFactor * 20),
                  }))
                  const links: Array<{ source: string; target: string; strength?: number }> = []
                  const linkSet = new Set<string>()
                  const pushLink = (source: string, target: string, strength: number) => {
                    const key = source < target ? `${source}::${target}` : `${target}::${source}`
                    if (linkSet.has(key)) return
                    linkSet.add(key)
                    links.push({ source, target, strength })
                  }

                  // Link files that share dominant author
                  for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                      if (nodes[i].dominant && nodes[i].dominant === nodes[j].dominant) {
                        pushLink(nodes[i].id, nodes[j].id, 1.2)
                      }
                    }
                  }

                  // Link by concentration neighborhood for better shape when dominant author is sparse
                  const sortedByRisk = [...nodes].sort((a, b) => b.concentration - a.concentration)
                  for (let i = 0; i < sortedByRisk.length - 1; i++) {
                    pushLink(sortedByRisk[i].id, sortedByRisk[i + 1].id, 0.85)
                  }

                  // Ensure hub connectivity from highest-risk node
                  if (sortedByRisk.length > 2) {
                    const hub = sortedByRisk[0]
                    for (let i = 1; i < Math.min(sortedByRisk.length, 6); i++) {
                      pushLink(hub.id, sortedByRisk[i].id, 0.65)
                    }
                  }

                  const topContributors = [...new Set(data.criticalFiles
                    .map((f) => f.dominant_author)
                    .filter((author): author is string => Boolean(author)))]
                    .slice(0, 6)

                  return (
                    <div className="space-y-3">
                      <div className="w-full h-[320px] bg-background rounded-lg border border-border overflow-hidden relative">
                        <ForceGraph nodes={nodes} links={links} />
                      </div>
                      {topContributors.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top contributors in map:</span>
                          {topContributors.map((author) => (
                            <div key={author} className="px-2.5 py-1 rounded-full bg-muted/60 border border-border text-[10px]">
                              {renderContributorIdentity(author, { avatarSizeClass: 'size-4', textClassName: 'text-[10px] font-semibold text-foreground' })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* MESSAGES TAB */}
        {tab === 'messages' && data && (
          <div className="space-y-5">
            <Card className="py-0 border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white">
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                      Team Messages ({realtimeMessages.length})
                      {realtimeMessages.length > 0 && <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" title="Live" />}
                    </h2>
                    <p className="text-xs text-slate-500">Live stream with blocker and keyword detection from message analysis.</p>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      value={msgSearch}
                      onChange={(e) => setMsgSearch(e.target.value)}
                      placeholder="Search by author, channel or content"
                      className="pl-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Total Messages</p>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">{realtimeMessages.length}</p>
                  </div>
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-3">
                    <p className="text-[11px] text-red-500">Detected Blockers</p>
                    <p className="text-xl font-bold text-red-600 mt-0.5">{blockerMessagesCount}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                    <p className="text-[11px] text-amber-600">Messages With Keywords</p>
                    <p className="text-xl font-bold text-amber-700 mt-0.5">{keywordMessagesCount}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {([
                    { id: 'all', label: 'All' },
                    { id: 'blockers', label: 'Blockers' },
                    { id: 'keywords', label: 'Keywords' },
                    { id: 'questions', label: 'Questions' },
                  ] as const).map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setMsgViewFilter(filter.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        msgViewFilter === filter.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="py-0 border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white">
              <CardContent className="p-4">
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  if (!msgInput.trim() || sendingMsg || !token) return
                  const content = msgInput.trim()
                  setSendingMsg(true)
                  setMsgInput('')
                  const optimisticId = `opt-${Date.now()}`
                  const optimisticMsg = {
                    id: optimisticId,
                    source: 'app',
                    channel_name: 'general',
                    author_username: user?.name ?? user?.email ?? 'You',
                    content,
                    sent_at: new Date().toISOString(),
                    intent: null,
                    entities: null,
                    is_blocker: false,
                  }
                  pendingOptimisticIds.current.add(optimisticId)
                  setRealtimeMessages((prev) => [optimisticMsg, ...prev])
                  try {
                    const res = await fetch(`/api/workspaces/${workspaceId}/messages`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content }),
                    })
                    if (res.ok) {
                      const { message: saved } = await res.json()
                      setRealtimeMessages((prev) => {
                        const hasOptimistic = prev.some((m) => m.id === optimisticId)
                        const hasReal = prev.some((m) => m.id === saved.id)
                        if (hasOptimistic && !hasReal) return prev.map((m) => m.id === optimisticId ? { ...saved } : m)
                        if (hasOptimistic && hasReal) return prev.filter((m) => m.id !== optimisticId)
                        return prev
                      })
                      pendingOptimisticIds.current.delete(optimisticId)
                    } else {
                      const d = await res.json()
                      toast.error(d.error || 'Failed to send')
                      setRealtimeMessages((prev) => prev.filter((m) => m.id !== optimisticId))
                      pendingOptimisticIds.current.delete(optimisticId)
                    }
                  } catch {
                    toast.error('Failed to send message')
                    setRealtimeMessages((prev) => prev.filter((m) => m.id !== optimisticId))
                    pendingOptimisticIds.current.delete(optimisticId)
                  }
                  finally { setSendingMsg(false) }
                }} className="flex items-end gap-2">
                  <textarea
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        e.currentTarget.form?.requestSubmit()
                      }
                    }}
                    placeholder="Share updates, blockers, or task progress..."
                    rows={1}
                    className="flex-1 px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-[36px] max-h-[120px]"
                    style={{ height: 'auto', overflow: 'hidden' }}
                    onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sendingMsg || !msgInput.trim()}
                    className="shrink-0 gap-1.5"
                  >
                    {sendingMsg ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                    Send
                  </Button>
                </form>
              </CardContent>
            </Card>

            {filteredMessages.length === 0 ? (
              <Card className="py-0 shadow-sm border-border/50">
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No messages match this view.</p>
                  <p className="text-xs text-muted-foreground mt-1">Try clearing search or changing the filter.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="py-0 border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white">
                <CardContent className="p-0 divide-y divide-border max-h-[560px] overflow-y-auto">
                  {filteredMessages.map((msg) => {
                    const sourceConfig: Record<string, { bg: string; text: string; label: string }> = {
                      app: { bg: 'bg-primary/20', text: 'text-primary', label: 'CSP' },
                      discord: { bg: 'bg-indigo-500/20', text: 'text-indigo-500', label: 'D' },
                      whatsapp: { bg: 'bg-emerald-500/20', text: 'text-emerald-500', label: 'W' },
                    }
                    const src = sourceConfig[msg.source] ?? sourceConfig.app
                    const keywords = messageKeywords(msg)
                    const isBlocker = isBlockerMessage(msg)
                    const aiSummary = typeof msg.entities?.aiSummary === 'string' ? msg.entities.aiSummary : null
                    const intentTone = msg.intent === 'blocker'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : msg.intent === 'question'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : msg.intent === 'progress_update' || msg.intent === 'status_update'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : msg.intent === 'task_claim'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'

                    return (
                      <div key={msg.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${src.bg}`}>
                            <span className={`text-[10px] font-bold ${src.text}`}>{src.label}</span>
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{msg.author_username}</span>
                              {msg.channel_name && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-0.5 bg-slate-100 rounded-full px-2 py-0.5">
                                  <Hash className="w-2.5 h-2.5" />{msg.channel_name}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 ml-auto shrink-0">
                                {formatDistanceToNow(new Date(msg.sent_at), { addSuffix: true })}
                              </span>
                            </div>

                            <p className="text-sm text-slate-700 whitespace-pre-wrap wrap-break-word">{msg.content}</p>

                            <div className="flex flex-wrap items-center gap-1.5">
                              {isBlocker && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Blocker
                                </span>
                              )}
                              {msg.intent && msg.intent !== 'general' && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${intentTone}`}>
                                  {msg.intent.replace(/_/g, ' ')}
                                </span>
                              )}
                              {keywords.slice(0, 4).map((keyword) => (
                                <span key={keyword} className="text-[10px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-medium">
                                  {keyword}
                                </span>
                              ))}
                            </div>

                            {aiSummary && (
                              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2">
                                <span className="font-semibold text-slate-700">AI Summary:</span> {aiSummary}
                              </p>
                            )}
                          </div>

                          {isAdmin && !msg.id.startsWith('opt-') && (
                            <button
                              onClick={async () => {
                                if (deletingMsgId) return
                                setDeletingMsgId(msg.id)
                                try {
                                  const res = await fetch(`/api/workspaces/${workspaceId}/messages`, {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ message_id: msg.id }),
                                  })
                                  if (res.ok) {
                                    setRealtimeMessages((prev) => prev.filter((m) => m.id !== msg.id))
                                    toast.success('Message deleted')
                                  } else {
                                    const d = await res.json()
                                    toast.error(d.error || 'Failed to delete')
                                  }
                                } catch {
                                  toast.error('Failed to delete message')
                                } finally {
                                  setDeletingMsgId(null)
                                }
                              }}
                              disabled={deletingMsgId === msg.id}
                              className="shrink-0 p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10 disabled:opacity-50"
                              title="Delete message (admin)"
                            >
                              {deletingMsgId === msg.id ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* TEAM TAB — Per-contributor analysis (AR-VCS-002..012) */}
        {tab === 'team' && data && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Team Contributions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Per-contributor analysis — commits, PRs, issues, lines changed, and activity status</p>
            </div>

            {(!data.teamStats || data.teamStats.length === 0) ? (
              <Card className="py-0 shadow-sm border-border/50">
                <CardContent className="p-12 text-center">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No contributor data yet</p>
                <p className="text-xs text-muted-foreground mt-1">Bind a GitHub repo and data will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="py-0 shadow-sm border-border/50">
                    <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{data.teamStats.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Contributors</p>
                    </CardContent>
                  </Card>
                  <Card className="py-0 shadow-sm border-border/50">
                    <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{data.teamStats.filter(t => t.status === 'active').length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Active (&lt;48h)</p>
                    </CardContent>
                  </Card>
                  <Card className="py-0 shadow-sm border-border/50">
                    <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-400">{data.teamStats.filter(t => t.status === 'moderate').length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Moderate (48h–7d)</p>
                    </CardContent>
                  </Card>
                  <Card className="py-0 shadow-sm border-border/50">
                    <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">{data.teamStats.filter(t => t.status === 'inactive').length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Inactive (&gt;7d)</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Commit distribution chart */}
                {data.teamStats.length > 0 && (
                  <Card className="py-0 shadow-sm border-border/50">
                    <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-4">Commit Distribution</p>
                    <div style={{ height: Math.max(200, data.teamStats.slice(0, 15).length * 40) }}>
                      <ChartBar
                        data={{
                          labels: data.teamStats.slice(0, 15).map((t) => t.username),
                          datasets: [
                            { label: 'Commits', data: data.teamStats.slice(0, 15).map((t) => t.commits), backgroundColor: 'rgba(52,211,153,0.7)', borderColor: '#34d399', borderWidth: 1.5, borderRadius: 6 },
                            { label: 'PRs Opened', data: data.teamStats.slice(0, 15).map((t) => t.prsOpened), backgroundColor: 'rgba(96,165,250,0.7)', borderColor: '#60a5fa', borderWidth: 1.5, borderRadius: 6 },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          indexAxis: 'y' as const,
                          plugins: {
                            legend: {
                              display: true,
                              position: 'bottom' as const,
                              labels: {
                                boxWidth: 12,
                                boxHeight: 12,
                                usePointStyle: true,
                                pointStyle: 'rectRounded',
                                padding: 20,
                                color: 'hsl(var(--foreground))',
                                font: { size: 11, weight: 500 },
                              },
                            },
                            tooltip: {
                              callbacks: {
                                label: ((ctx: { dataset: { label: string }; parsed: { x: number } }) => ` ${ctx.dataset.label}: ${ctx.parsed.x}`) as never,
                              },
                            },
                          },
                          scales: {
                            x: { grid: { color: 'hsl(var(--border))' }, ticks: { color: 'hsl(var(--muted-foreground))', font: { size: 10 } } },
                            y: { grid: { display: false }, ticks: { color: 'hsl(var(--foreground))', font: { size: 11, weight: 500 } } },
                          },
                        }}
                      />
                    </div>
                    {/* Summary legend */}
                    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-emerald-400" />
                        <span className="text-[11px] text-foreground font-medium">Commits</span>
                        <span className="text-[10px] text-muted-foreground">({data.teamStats.slice(0, 15).reduce((s, t) => s + t.commits, 0)} total)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-blue-400" />
                        <span className="text-[11px] text-foreground font-medium">PRs Opened</span>
                        <span className="text-[10px] text-muted-foreground">({data.teamStats.slice(0, 15).reduce((s, t) => s + t.prsOpened, 0)} total)</span>
                      </div>
                    </div>
                    </CardContent>
                  </Card>
                )}

                {/* Contributor cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {data.teamStats.map((member) => {
                    const statusColors: Record<string, string> = {
                      active: 'bg-emerald-400/20 text-emerald-400 border-emerald-400/30',
                      moderate: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
                      inactive: 'bg-red-400/20 text-red-400 border-red-400/30',
                    }
                    const totalLines = member.linesAdded + member.linesDeleted
                    return (
                      <Card key={member.username} className="py-0 shadow-sm border-border/50">
                        <CardContent className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9">
                              {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                              <AvatarFallback className="text-sm">{member.username[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{member.username}</p>
                              {member.lastActive && (
                                <p className="text-[10px] text-muted-foreground">
                                  Last active {formatDistanceToNow(new Date(member.lastActive), { addSuffix: true })}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${statusColors[member.status] ?? statusColors.inactive}`}>
                            {member.status}
                          </Badge>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-2 bg-muted/30 rounded-lg">
                            <p className="text-lg font-bold text-foreground">{member.commits}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Commits</p>
                          </div>
                          <div className="text-center p-2 bg-muted/30 rounded-lg">
                            <p className="text-lg font-bold text-foreground">{member.prsOpened}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">PRs Opened</p>
                          </div>
                          <div className="text-center p-2 bg-muted/30 rounded-lg">
                            <p className="text-lg font-bold text-foreground">{member.prsMerged}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">PRs Merged</p>
                          </div>
                        </div>

                        {/* Lines changed bar */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Lines changed</span>
                            <span>
                              <span className="text-emerald-400">+{member.linesAdded.toLocaleString()}</span>
                              {' / '}
                              <span className="text-red-400">-{member.linesDeleted.toLocaleString()}</span>
                            </span>
                          </div>
                          {totalLines > 0 ? (
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                              <div className="h-full bg-emerald-500" style={{ width: `${(member.linesAdded / totalLines) * 100}%` }} />
                              <div className="h-full bg-red-500" style={{ width: `${(member.linesDeleted / totalLines) * 100}%` }} />
                            </div>
                          ) : (
                            <div className="h-1.5 bg-muted rounded-full" />
                          )}
                        </div>

                        {/* Extra details row */}
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {member.issuesAssigned} issues assigned
                          </span>
                          <span className="flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            {member.activeBranches} active {member.activeBranches === 1 ? 'branch' : 'branches'}
                          </span>
                          {member.avgPRDuration !== null && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {member.avgPRDuration < 1
                                ? `${Math.round(member.avgPRDuration * 60)}m avg PR`
                                : member.avgPRDuration < 24
                                ? `${member.avgPRDuration.toFixed(1)}h avg PR`
                                : `${(member.avgPRDuration / 24).toFixed(1)}d avg PR`}
                            </span>
                          )}
                        </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* AI INSIGHTS TAB */}
        {tab === 'insights' && (
          <div className="max-w-4xl mx-auto py-8 animate-in fade-in duration-500">
            {(() => {
              const persistedInsights = ((data as unknown as { insights?: Array<{ id: string; title?: string; content?: string; tags?: string[]; created_at?: string }> | undefined })?.insights) ?? []
              const hasGeneratedInsight = Boolean(aiAnalysis)
              const hasPersistedInsights = persistedInsights.length > 0
              const hasAnyInsights = hasGeneratedInsight || hasPersistedInsights

              return (
                <>
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-[28px] font-display font-bold text-slate-900 tracking-tight">AI Insights</h2>
                <p className="text-[13px] text-slate-500 mt-1 font-medium">Actionable intelligence for your codebase</p>
              </div>
              <Button onClick={async () => {
                  if (loadingInsights || !token) return
                  setLoadingInsights(true)
                  try {
                    const res = await fetch(`/api/workspaces/${workspaceId}/insights/generate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
                    const body = await res.json().catch(() => ({}))
                    if (res.ok && body.insight) {
                      setAiAnalysis(body.insight)
                      toast.success('Insights generated successfully')
                    } else {
                      toast.error(body.error || 'Failed to generate insights')
                    }
                  } catch {
                    toast.error('Failed to generate insights')
                  }
                  finally { setLoadingInsights(false) }
                }} 
                disabled={loadingInsights}
                className="rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-[0_8px_16px_rgba(15,23,42,0.2)] px-6 h-11 font-bold text-[13px]">
                {loadingInsights ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Brain className="size-4 mr-2" />}
                Generate New Insights
              </Button>
            </div>

            {/* AI Task Creator + Task List */}
            <Card className="border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white mb-6">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[16px] font-bold text-slate-900 tracking-tight flex items-center gap-2"><ListTodo className="size-4" /> AI Task Creator</h3>
                    <p className="text-[12px] text-slate-500 mt-1">Generate a practical task backlog from your project description.</p>
                  </div>
                  <Button variant="outline" onClick={() => setShowAddTodo((v) => !v)} className="rounded-xl h-9 text-xs font-semibold">
                    <Plus className="size-3.5 mr-1" /> {showAddTodo ? 'Close Manual Task' : 'Add Task Manually'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <textarea
                    value={aiProjectDesc}
                    onChange={(e) => setAiProjectDesc(e.target.value)}
                    placeholder="Describe your current project goals, deliverables, and constraints..."
                    className="lg:col-span-2 min-h-[88px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <div className="flex lg:flex-col gap-2">
                    <Button onClick={generateAiTasks} disabled={aiGenerating || !aiProjectDesc.trim()} className="rounded-xl h-10 text-xs font-semibold">
                      {aiGenerating ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />} Generate Tasks
                    </Button>
                    <Button variant="outline" onClick={() => fetchTodos()} disabled={todosLoading} className="rounded-xl h-10 text-xs font-semibold">
                      {todosLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <RefreshCw className="size-3.5 mr-1" />} Refresh Tasks
                    </Button>
                  </div>
                </div>

                {showAddTodo && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <Input value={newTodoTitle} onChange={(e) => setNewTodoTitle(e.target.value)} placeholder="Task title" className="md:col-span-2 bg-white" />
                    <Input value={newTodoDesc} onChange={(e) => setNewTodoDesc(e.target.value)} placeholder="Short description" className="md:col-span-2 bg-white" />
                    <select value={newTodoPriority} onChange={(e) => setNewTodoPriority(e.target.value as 'low' | 'medium' | 'high' | 'critical')} className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <Input type="date" value={newTodoDeadline} onChange={(e) => setNewTodoDeadline(e.target.value)} className="bg-white" />
                    <div className="md:col-span-2 flex justify-end">
                      <Button onClick={addTodo} disabled={addingTodo || !newTodoTitle.trim()} className="rounded-lg h-9 text-xs font-semibold">
                        {addingTodo ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Plus className="size-3.5 mr-1" />} Create Task
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tasks ({todos.length})</p>
                    <p className="text-[11px] text-slate-400">Pending {(todos.filter((t) => t.status !== 'completed').length)}</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {todos.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[12px] text-slate-500">No tasks yet. Use AI Task Creator to generate your backlog.</div>
                    ) : (
                      todos.map((todo) => (
                        <div key={todo.id} className="px-3 py-2.5 flex items-start gap-3">
                          <button
                            onClick={() => updateTodoStatus(todo.id, todo.status === 'completed' ? 'pending' : 'completed')}
                            className={`mt-0.5 size-4 rounded-full border ${todo.status === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'}`}
                            title={todo.status === 'completed' ? 'Mark as pending' : 'Mark as completed'}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-semibold ${todo.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{todo.title}</p>
                            {todo.description && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{todo.description}</p>}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                todo.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                todo.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                todo.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>{todo.priority}</span>
                              <span className="text-[10px] text-slate-500">{todo.status}</span>
                              {todo.deadline && <span className="text-[10px] text-slate-500">Due {new Date(todo.deadline).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <button onClick={() => removeTodo(todo.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50" title="Delete task">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content Area */}
            {!hasAnyInsights ? (
              <Card className="border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white">
                <CardContent className="py-24 flex flex-col items-center justify-center text-center">
                  <div className="size-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                    <Sparkles className="size-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No Insights Generated Yet</h3>
                  <p className="text-[13px] text-slate-500 mt-2 max-w-sm">
                    Run an analysis on your repository to uncover patterns, bus factors, and structural improvements.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {aiAnalysis && (
                  <Card className="border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white">
                    <CardContent className="p-8 space-y-5">
                      <div className="flex items-start gap-5">
                        <div className="shrink-0 p-3 bg-indigo-50 rounded-2xl text-indigo-500 shadow-inner">
                          <Brain className="size-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[16px] font-bold text-slate-900 tracking-tight">Latest AI Workspace Analysis</h4>
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                              {new Date().toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-[14px] leading-relaxed text-slate-600">{aiAnalysis.summary}</p>
                        </div>
                      </div>

                      {aiAnalysis.risks.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Risks</p>
                          <ul className="space-y-1">
                            {aiAnalysis.risks.map((risk, idx) => (
                              <li key={idx} className="text-[13px] text-slate-600 flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiAnalysis.suggestions.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Suggestions</p>
                          <ul className="space-y-1">
                            {aiAnalysis.suggestions.map((suggestion, idx) => (
                              <li key={idx} className="text-[13px] text-slate-600 flex items-start gap-2"><span className="text-indigo-400 mt-0.5">•</span>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiAnalysis.nextSteps.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Next Steps</p>
                          <ul className="space-y-1">
                            {aiAnalysis.nextSteps.map((step, idx) => (
                              <li key={idx} className="text-[13px] text-slate-600 flex items-start gap-2"><span className="text-emerald-400 mt-0.5">•</span>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiAnalysis.teamDynamics && (
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Team Dynamics</p>
                          <p className="text-[13px] text-slate-600">{aiAnalysis.teamDynamics}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {persistedInsights.map((insight) => (
                  <Card key={insight.id} className="border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] rounded-[2rem] overflow-hidden bg-white">
                    <CardContent className="p-8">
                      <div className="flex items-start gap-5">
                        <div className="shrink-0 p-3 bg-indigo-50 rounded-2xl text-indigo-500 shadow-inner">
                          <Brain className="size-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[16px] font-bold text-slate-900 tracking-tight">{insight.title || 'Codebase Insight'}</h4>
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                              {insight.created_at ? new Date(insight.created_at).toLocaleDateString() : '—'}
                            </span>
                          </div>
                          
                          <p className="text-[14px] leading-relaxed text-slate-600 mb-6">
                            {insight.content ?? 'No content available'}
                          </p>

                          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                             {(insight.tags || ['refactor', 'architecture']).map((tag, idx) => (
                               <span key={idx} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider rounded-xl border border-slate-100">
                                 {tag}
                               </span>
                             ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
                </>
              )
            })()}
          </div>
        )}

        {tab === 'settings' && wsInfo && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Workspace Settings</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Repository binding, integrations, and team management</p>
            </div>

            {/* AR-VCS-014/015: Repository Binding */}
            <Card className="py-0 shadow-sm border-border/50">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <GitBranch className="w-4 h-4" /> Repository Binding
              </h3>
              {repoBinding?.bound && repoBinding.repo ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-5 h-5 text-primary" />
                      <div>
                        <a href={repoBinding.repo.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                          {repoBinding.repo.owner}/{repoBinding.repo.name}
                        </a>
                        <div className="flex items-center gap-2 mt-0.5">
                          {repoBinding.repo.private && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">Private</span>}
                          <span className="text-[10px] text-muted-foreground">default: {repoBinding.repo.default_branch}</span>
                          {repoBinding.repo.webhook_active && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> Webhook active</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={unbindRepo} disabled={unbindLoading} className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-400/10 disabled:opacity-50 flex items-center gap-1">
                      {unbindLoading ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      {unbindLoading ? 'Unbinding...' : 'Unbind'}
                    </button>
                  </div>
                  {/* Manual webhook info */}
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground transition-colors">Manual webhook details</summary>
                    <div className="bg-muted rounded-lg p-3 mt-2 space-y-2">
                      <div>
                        <span>Payload URL:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-foreground bg-background px-2 py-1 rounded text-[11px] break-all">
                            {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/github?workspace_id={workspaceId}
                          </code>
                          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/github?workspace_id=${workspaceId}`); toast.success('Copied!') }} className="p-1 hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      {wsInfo.github_webhook_secret && <div>
                        <span>Secret:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-foreground bg-background px-2 py-1 rounded text-[11px] break-all">{wsInfo.github_webhook_secret}</code>
                          <button onClick={() => { navigator.clipboard.writeText(wsInfo.github_webhook_secret ?? ''); toast.success('Copied!') }} className="p-1 hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>}
                      <div><span>Events:</span> <code className="text-foreground ml-1">push, pull_request, issues, deployment_status, member</code></div>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Select a GitHub repository to monitor. This will configure webhooks, fetch historical data, and sync collaborators.</p>
                  {repoList.length === 0 ? (
                    <button onClick={fetchRepos} disabled={repoLoading} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2">
                      {repoLoading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading repos...</> : <><GitBranch className="w-3.5 h-3.5" /> Browse Repositories</>}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input value={repoSearch} onChange={(e) => setRepoSearch(e.target.value)} placeholder="Filter repositories..." className="w-full pl-8 pr-3 py-2 bg-muted border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring text-foreground" />
                      </div>
                      <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                        {filteredRepos.slice(0, 50).map((r) => (
                          <button key={r.id} onClick={() => bindRepo(r.owner, r.name)} disabled={bindingLoading}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center justify-between group">
                            <div className="flex items-center gap-2 min-w-0">
                              <img src={r.owner_avatar} alt="" className="w-5 h-5 rounded-full" />
                              <div className="min-w-0">
                                <span className="text-xs font-medium text-foreground block truncate">{r.full_name}</span>
                                <div className="flex items-center gap-2">
                                  {r.description && <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.description}</span>}
                                  {r.language && <span className="text-[10px] text-muted-foreground">{r.language}</span>}
                                  {r.private && <span className="text-[10px] px-1 py-0 bg-yellow-500/10 text-yellow-400 rounded">Private</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                              {bindingLoading ? 'Binding...' : 'Select'}
                            </span>
                          </button>
                        ))}
                        {filteredRepos.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No matching repositories found</div>}
                      </div>
                      <button onClick={() => setRepoList([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            </Card>

            {/* AR-VCS-023/024/025/026/027: Collaborators & External Contributors */}
            {repoBinding?.bound && (
              <Card className="py-0 shadow-sm border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Repository Collaborators ({repoBinding.collaborators?.length ?? 0})</h3>
                    {repoBinding.collaborators_updated_at && <p className="text-[10px] text-muted-foreground">Updated {formatDistanceToNow(new Date(repoBinding.collaborators_updated_at), { addSuffix: true })}</p>}
                  </div>
                  <button onClick={refreshCollaborators} disabled={collabRefreshing} title="Refresh collaborators" className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded disabled:opacity-50">
                    {collabRefreshing ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {(repoBinding.collaborators ?? []).map((c) => (
                    <div key={c.username} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={c.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                        <span className="text-xs font-medium text-foreground">@{c.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.role_name === 'admin' ? 'bg-primary/20 text-primary' : c.role_name === 'maintain' ? 'bg-blue-400/20 text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                          {c.role_name}
                        </span>
                        {c.permissions?.push && <span className="text-[10px] text-emerald-400">push</span>}
                      </div>
                    </div>
                  ))}
                  {(repoBinding.collaborators?.length ?? 0) === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">No collaborators loaded. Click refresh to fetch.</div>
                  )}
                </div>
                {/* External contributors (AR-VCS-027) */}
                {collabInfo?.external_contributors && collabInfo.external_contributors.external.length > 0 && (
                  <div className="px-5 py-3 border-t border-border bg-yellow-500/5">
                    <p className="text-xs font-medium text-yellow-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      {collabInfo.external_contributors.external.length} external contributor{collabInfo.external_contributors.external.length !== 1 ? 's' : ''} detected
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      These users have commits/PRs but are not listed as repo collaborators:
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {collabInfo.external_contributors.external.map((u) => (
                        <span key={u} className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">@{u}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Unmapped authors (AR-VCS-026) */}
                {collabInfo?.author_mapping && collabInfo.author_mapping.unmapped_authors.length > 0 && (
                  <div className="px-5 py-3 border-t border-border bg-blue-500/5">
                    <p className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
                      <Info className="w-3 h-3" />
                      {collabInfo.author_mapping.unmapped_authors.length} unmapped commit author{collabInfo.author_mapping.unmapped_authors.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {collabInfo.author_mapping.unmapped_authors.slice(0, 20).map((u) => (
                        <span key={u} className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">{u}</span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              </Card>
            )}

            {/* Invite */}
            <Card className="py-0 shadow-sm border-border/50">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Team Invitations
              </h3>
              <p className="text-xs text-muted-foreground">Create and share a secure 48-hour invite link from one place.</p>
              <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
                <UserMinus className="w-3.5 h-3.5" /> Open Invite Flow
              </Button>
            </CardContent>
            </Card>

            {/* Members */}
            {data && (
              <Card className="py-0 shadow-sm border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Team Members ({data.members.length})</h3>
                </div>
                <div className="divide-y divide-border">
                  {data.members.map((m) => (
                    <div key={m.user?.id} className="px-5 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-7">
                          {m.user?.avatar_url && <AvatarImage src={m.user.avatar_url} />}
                          <AvatarFallback className="text-xs">{m.user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-medium text-foreground">{m.user?.name}</p>
                          {m.user?.github_username && <p className="text-[10px] text-muted-foreground">@{m.user.github_username}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${m.role === 'admin' ? 'bg-primary/20 text-primary' : ''}`}>
                          {m.role}
                        </Badge>
                        {isAdmin && m.user?.id !== user?.id && (
                          <button
                            onClick={async () => {
                              if (removingMemberId) return
                              setRemovingMemberId(m.user?.id ?? null)
                              try {
                                const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ target_user_id: m.user?.id }),
                                })
                                if (res.ok) {
                                  toast.success(`${m.user?.name ?? 'Member'} removed`)
                                  refetch()
                                } else {
                                  const d = await res.json()
                                  toast.error(d.error || 'Failed to remove member')
                                }
                              } catch { toast.error('Failed to remove member') }
                              finally { setRemovingMemberId(null) }
                            }}
                            disabled={removingMemberId === m.user?.id}
                            className="p-1 text-muted-foreground hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10 disabled:opacity-50"
                            title="Remove member"
                          >
                            {removingMemberId === m.user?.id ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <UserMinus className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              </Card>
            )}

            {/* Profile Card */}
            <Card className="py-0 shadow-sm border-border/50">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Your Profile
              </h3>
              <div className="flex items-start gap-4">
                <Avatar className="size-14 border-2 border-border">
                  {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
                  <AvatarFallback className="text-xl">{user?.name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  {editingProfile ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Display Name</label>
                        <input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="w-full mt-1 px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Your name"
                          maxLength={100}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            if (!profileName.trim() || profileSaving) return
                            setProfileSaving(true)
                            try {
                              const res = await fetch('/api/auth/me', {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: profileName.trim() }),
                              })
                              if (res.ok) {
                                const { user: updated } = await res.json()
                                setTokenAndUser(token!, updated)
                                toast.success('Profile updated')
                                setEditingProfile(false)
                                refetch()
                              } else {
                                const d = await res.json()
                                toast.error(d.error || 'Failed to update profile')
                              }
                            } catch { toast.error('Failed to update profile') }
                            finally { setProfileSaving(false) }
                          }}
                          disabled={profileSaving || !profileName.trim()}
                          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {profileSaving ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                          Save
                        </button>
                        <button onClick={() => setEditingProfile(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{user?.name}</p>
                        <button
                          onClick={() => { setProfileName(user?.name ?? ''); setEditingProfile(true) }}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                          title="Edit name"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                      {user?.github_username && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Github className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">@{user.github_username}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <KeyRound className="w-3 h-3 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground">ID: {user?.id?.slice(0, 8)}...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            </Card>

            {/* Workspace Rename (admin only) */}
            {isAdmin && (
              <Card className="py-0 shadow-sm border-border/50">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Pencil className="w-4 h-4" /> Workspace Name
                </h3>
                {editingWsName ? (
                  <div className="space-y-2">
                    <Input
                      value={wsNameInput}
                      onChange={(e) => setWsNameInput(e.target.value)}
                      placeholder="Workspace name"
                      maxLength={60}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!wsNameInput.trim() || wsNameSaving) return
                          setWsNameSaving(true)
                          try {
                            const res = await fetch(`/api/workspaces/${workspaceId}`, {
                              method: 'PATCH',
                              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: wsNameInput.trim() }),
                            })
                            if (res.ok) {
                              toast.success('Workspace renamed')
                              setWsInfo((prev) => prev ? { ...prev, name: wsNameInput.trim() } : prev)
                              setEditingWsName(false)
                            } else {
                              const d = await res.json()
                              toast.error(d.error || 'Failed to rename')
                            }
                          } catch { toast.error('Failed to rename workspace') }
                          finally { setWsNameSaving(false) }
                        }}
                        disabled={wsNameSaving || !wsNameInput.trim()}
                        className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {wsNameSaving ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </button>
                      <button onClick={() => setEditingWsName(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-foreground font-medium">{wsInfo.name}</p>
                    <button
                      onClick={() => { setWsNameInput(wsInfo.name); setEditingWsName(true) }}
                      className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted flex items-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3" /> Rename
                    </button>
                  </div>
                )}
              </CardContent>
              </Card>
            )}

            {/* Notification Preferences */}
            <Card className="py-0 shadow-sm border-border/50">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4" /> Notification Preferences
              </h3>
              <p className="text-xs text-muted-foreground">Choose which notifications you want to receive in this workspace</p>
              <div className="space-y-3">
                {[
                  { key: 'alerts' as const, label: 'Alert Notifications', desc: 'Get notified when new alerts are generated (stale PRs, blockers, etc.)' },
                  { key: 'messages' as const, label: 'Message Notifications', desc: 'Get notified when new team messages arrive' },
                  { key: 'heuristics' as const, label: 'Heuristic Scan Results', desc: 'Get notified when automated heuristic scans detect issues' },
                ].map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-medium text-foreground">{pref.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pref.desc}</p>
                    </div>
                    <Switch
                      checked={notifPrefs[pref.key]}
                      onCheckedChange={() => {
                        setNotifPrefs((prev) => ({ ...prev, [pref.key]: !prev[pref.key] }))
                        toast.success(`${pref.label} ${notifPrefs[pref.key] ? 'disabled' : 'enabled'}`)
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="py-0 shadow-none border-red-500/20">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
              </h3>
              {isAdmin && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">Delete Workspace</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Permanently delete this workspace and all its data. This cannot be undone.</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (deletingWorkspace) return
                      const confirmed = confirm('Are you sure you want to permanently delete this workspace? This cannot be undone.')
                      if (!confirmed) return
                      setDeletingWorkspace(true)
                      try {
                        const res = await fetch(`/api/workspaces/${workspaceId}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        })
                        if (res.ok) {
                          toast.success('Workspace deleted')
                          router.push('/dashboard')
                        } else {
                          const d = await res.json()
                          toast.error(d.error || 'Failed to delete')
                        }
                      } catch { toast.error('Failed to delete workspace') }
                      finally { setDeletingWorkspace(false) }
                    }}
                    disabled={deletingWorkspace}
                    className="shrink-0 gap-1.5"
                  >
                    {deletingWorkspace ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Delete Workspace
                  </Button>
                </div>
              )}
              <div className={`flex items-center justify-between ${isAdmin ? 'pt-2 border-t border-red-500/10' : ''}`}>
                <div>
                  <p className="text-xs font-medium text-foreground">Leave Workspace</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Remove yourself from this workspace. You can be re-invited later.</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ target_user_id: user?.id }),
                      })
                      if (res.ok) {
                        toast.success('Left workspace')
                        router.push('/dashboard')
                      } else {
                        const d = await res.json()
                        toast.error(d.error || 'Failed to leave')
                      }
                    } catch { toast.error('Failed to leave workspace') }
                  }}
                  className="shrink-0 gap-1.5"
                >
                  <LogOut className="w-3 h-3" /> Leave
                </Button>
              </div>
            </CardContent>
            </Card>
          </div>
        )}
      </main>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-[0_16px_48px_rgba(0,0,0,0.1)]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Invite Team Members</DialogTitle>
            <DialogDescription className="text-slate-500">
              Generate a secure 48-hour invite link to allow members to join this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {!inviteUrl ? (
              <Button onClick={generateInvite} disabled={inviteLoading} className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold text-[14px]">
                {inviteLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserMinus className="mr-2 h-5 w-5" />}
                {inviteLoading ? 'Generating Link...' : 'Generate Invite Link'}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex-1 font-mono text-[11px] text-slate-700 break-all select-all overflow-hidden">{inviteUrl}</div>
                  <Button onClick={copyInviteLink} variant="ghost" size="icon" className="shrink-0 text-slate-500 hover:text-slate-900 rounded-xl" title="Copy invite link">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button onClick={copyInviteLink} variant="outline" className="rounded-2xl h-11 font-bold">
                    {inviteCopied ? 'Copied' : 'Copy Link'}
                  </Button>
                  <Button onClick={generateInvite} disabled={inviteLoading} className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white h-11 font-bold">
                    {inviteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {inviteLoading ? 'Regenerating...' : 'Regenerate Link'}
                  </Button>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] text-amber-800 font-medium">This link expires in 48 hours.</p>
                  <p className="text-[10px] text-amber-700 mt-0.5">Generating a new link invalidates the previous one.</p>
                </div>
                <Button onClick={() => setInviteDialogOpen(false)} variant="outline" className="w-full rounded-2xl h-11 font-bold">Done</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
