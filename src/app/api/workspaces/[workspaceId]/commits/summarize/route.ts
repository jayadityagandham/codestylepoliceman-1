import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createServiceClient } from '@/lib/supabase'
import { summarizeCommits, GeminiRateLimitError } from '@/lib/gemini'
import { fetchLiveCommits } from '@/lib/github-api'

// POST /api/workspaces/[workspaceId]/commits/summarize — AI-analyze commits vs tasks
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

  // Get workspace info for GitHub repo binding
  const { data: workspace } = await db
    .from('workspaces')
    .select('github_repo_owner, github_repo_name')
    .eq('id', workspaceId)
    .single()

  const githubToken = req.cookies.get('github_token')?.value
  const repoOwner = workspace?.github_repo_owner
  const repoName = workspace?.github_repo_name

  // Build commits list: prefer live GitHub fetch, fallback to DB
  let commits: Array<{ message: string; author_github_username: string | null; commit_type: string | null; committed_at: string; lines_added: number; lines_deleted: number }> = []

  if (githubToken && repoOwner && repoName) {
    // Fetch live commits from GitHub API (same source as dashboard)
    const liveCommits = await fetchLiveCommits(githubToken, repoOwner, repoName, 50)
    commits = liveCommits.map((c) => ({
      message: c.message,
      author_github_username: c.author,
      commit_type: c.commit_type,
      committed_at: c.date,
      lines_added: 0,
      lines_deleted: 0,
    }))
  }

  // Fallback: try DB if live fetch returned nothing
  if (commits.length === 0) {
    const { data: dbCommits } = await db
      .from('commits')
      .select('message, author_github_username, commit_type, committed_at, lines_added, lines_deleted')
      .eq('workspace_id', workspaceId)
      .order('committed_at', { ascending: false })
      .limit(50)
    commits = dbCommits ?? []
  }

  if (commits.length === 0) {
    return NextResponse.json({ error: 'No commits found. Bind a GitHub repo first.' }, { status: 422 })
  }

  // Fetch todos in parallel
  const { data: todos } = await db
    .from('workspace_todos')
    .select('id, title, status, priority')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  try {
    const result = await summarizeCommits(commits, todos ?? [])

    if (!result) {
      return NextResponse.json({ error: 'AI could not analyze commits. Please try again.' }, { status: 422 })
    }

    // Sync task status from commit-task analysis
    const todoById = new Map((todos ?? []).map((t) => [t.id, t]))
    const todoByTitle = new Map((todos ?? []).map((t) => [t.title.trim().toLowerCase(), t]))
    const statusFromAnalysis: Record<'addressed' | 'partially-addressed' | 'not-addressed', 'completed' | 'in-progress' | null> = {
      addressed: 'completed',
      'partially-addressed': 'in-progress',
      'not-addressed': null,
    }

    let syncedTasksCount = 0

    for (const tp of result.taskProgress ?? []) {
      const mappedStatus = statusFromAnalysis[tp.status]
      if (!mappedStatus) continue

      const byId = todoById.get(tp.taskId)
      const byTitle = todoByTitle.get(tp.taskTitle.trim().toLowerCase())
      const target = byId ?? byTitle
      if (!target) continue
      if (target.status === mappedStatus) continue

      syncedTasksCount++
      const payload: { status: string; completed_at?: string | null } = { status: mappedStatus }
      if (mappedStatus === 'completed') payload.completed_at = new Date().toISOString()
      else payload.completed_at = null

      await db
        .from('workspace_todos')
        .update(payload)
        .eq('id', target.id)
        .eq('workspace_id', workspaceId)
    }

    return NextResponse.json({
      ...result,
      syncedTasksCount,
    })
  } catch (err) {
    if (err instanceof GeminiRateLimitError) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Please retry in ${Math.ceil(err.retryAfterMs / 1000)} seconds.`, retryAfterMs: err.retryAfterMs },
        { status: 429 },
      )
    }
    console.error('[Commit Summarize] AI error:', err)
    return NextResponse.json({ error: 'Commit analysis failed' }, { status: 500 })
  }
}
