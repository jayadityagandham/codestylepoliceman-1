import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createServiceClient } from '@/lib/supabase'
import { analyzeProject, GeminiRateLimitError } from '@/lib/gemini'

// POST /api/workspaces/[workspaceId]/insights/generate - generate live AI insights for the workspace
export async function POST(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params
  const { user, error } = await requireAuth(req)
  if (error) return error

  const db = createServiceClient()

  const { data: member } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const [
    { count: totalCommits },
    { count: openPRs },
    { count: openIssues },
    { count: teamSize },
    { data: latestHealth },
    { data: commitRows },
    { data: messages },
  ] = await Promise.all([
    db.from('commits').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    db.from('pull_requests').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('state', 'open'),
    db.from('issues').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('state', 'open'),
    db.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    db.from('health_snapshots').select('score').eq('workspace_id', workspaceId).order('snapshot_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('commits').select('author_github_username, commit_type').eq('workspace_id', workspaceId).order('committed_at', { ascending: false }).limit(200),
    db.from('discord_messages').select('author_username, content, intent, sent_at').eq('workspace_id', workspaceId).order('sent_at', { ascending: false }).limit(50),
  ])

  // workspace_todos may not exist in every deployment yet; treat as optional
  let todos: Array<{ title: string; status: string; priority: string; deadline: string | null }> = []
  try {
    const { data, error: todosErr } = await db
      .from('workspace_todos')
      .select('title, status, priority, deadline')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!todosErr && data) todos = data
  } catch {
    todos = []
  }

  // Compute simple bus factor from commit author concentration
  const authorCounts: Record<string, number> = {}
  for (const c of commitRows ?? []) {
    const author = c.author_github_username ?? 'unknown'
    authorCounts[author] = (authorCounts[author] ?? 0) + 1
  }
  const totalAuthorCommits = Object.values(authorCounts).reduce((sum, n) => sum + n, 0)
  let busFactor = 0
  if (totalAuthorCommits > 0) {
    const sortedCounts = Object.values(authorCounts).sort((a, b) => b - a)
    let covered = 0
    for (const n of sortedCounts) {
      covered += n
      busFactor += 1
      if (covered / totalAuthorCommits >= 0.5) break
    }
  }

  const recentCommitTypes: Record<string, number> = {}
  for (const c of commitRows ?? []) {
    const type = c.commit_type ?? 'chore'
    recentCommitTypes[type] = (recentCommitTypes[type] ?? 0) + 1
  }

  try {
    const analysis = await analyzeProject({
      messages: (messages ?? []).map((m) => ({
        author: m.author_username,
        content: m.content,
        intent: m.intent,
        sent_at: m.sent_at,
      })),
      todos,
      healthScore: latestHealth?.score ?? 50,
      openPRs: openPRs ?? 0,
      openIssues: openIssues ?? 0,
      totalCommits: totalCommits ?? 0,
      teamSize: teamSize ?? 0,
      busFactor,
      recentCommitTypes,
    })

    if (!analysis) {
      return NextResponse.json({ error: 'AI could not generate insights right now. Please try again.' }, { status: 422 })
    }

    return NextResponse.json({ insight: analysis })
  } catch (err) {
    if (err instanceof GeminiRateLimitError) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Please retry in ${Math.ceil(err.retryAfterMs / 1000)} seconds.`, retryAfterMs: err.retryAfterMs },
        { status: 429 },
      )
    }

    console.error('[AI Insights] generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate AI insights' }, { status: 500 })
  }
}
