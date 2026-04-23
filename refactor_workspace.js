const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/[workspaceId]/page.tsx', 'utf-8');

// 1. Fix Layout (Sidebar and Main Area)
const oldSidebarRegex = /<aside className="w-\[280px\] bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-full relative z-20">([\s\S]*?)<\/aside>\s*\{\/\* Main Content Area \*\/\}\s*<div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">/;
const newSidebar = `<aside className="w-[280px] bg-white border-r border-slate-100 flex flex-col justify-between shrink-0 h-full relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8">
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <div className="size-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-[0_8px_16px_rgba(15,23,42,0.2)]">
              <Shield className="size-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight tracking-tight text-slate-900">Code<br/>Policeman</h2>
            </div>
          </div>
          
          <div className="mt-12 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 px-4">Menu</p>
            <div className="space-y-1.5">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={\`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all duration-200 \${
                    tab === id 
                      ? 'bg-slate-900 text-white shadow-[0_8px_16px_rgba(15,23,42,0.15)]' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }\`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon className={\`size-4.5 \${tab === id ? 'text-white' : 'text-slate-400'}\`} />
                    {label.split(' ')[0]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100">
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
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-[#f4f5f8]">`;

content = content.replace(oldSidebarRegex, newSidebar);

// Also fix the top div wrapper from bg-slate-50 to bg-[#f4f5f8]
content = content.replace('<div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans relative">', '<div className="flex h-screen w-full bg-[#f4f5f8] text-slate-900 overflow-hidden font-sans relative">');

// 2. Fix the Header to match the new one
const oldHeaderRegex = /<header className="h-20 px-8 flex items-center justify-between shrink-0 mt-2">([\s\S]*?)<\/header>/;
const newHeader = `<header className="h-24 pr-10 pl-8 flex items-center justify-between shrink-0 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex flex-col justify-center">
              <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight leading-none mb-1 flex items-center gap-3">
                {wsInfo?.name ?? 'Loading...'}
                {data?.overview && (
                  <span className={\`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider \${
                    data.overview.healthScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                    data.overview.healthScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }\`}>
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
                    <RefreshCw className={\`size-4.5 text-slate-600 \${loading ? 'animate-spin' : ''}\`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)} className="rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-[0_8px_16px_rgba(15,23,42,0.2)] px-6 h-11 ml-2 font-bold text-[13px]">
              <UserMinus className="size-4 mr-2" /> Invite
            </Button>
          </div>
        </header>`;

content = content.replace(oldHeaderRegex, newHeader);

// 3. Center the Settings Tab Content
// Look for {tab === 'settings' && wsInfo && (  ... )}
const settingsRegex = /\{tab === 'settings' && wsInfo && \([\s\S]*?<div className="space-y-6">/;
content = content.replace(settingsRegex, `{tab === 'settings' && wsInfo && (
          <div className="max-w-4xl mx-auto py-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Workspace Settings</h2>
              <p className="text-sm text-slate-500 mt-1">Repository binding, integrations, and team management</p>
            </div>
            <div className="space-y-8">`);

// Close the max-w-4xl wrapper at the end of settings
// Find the end of settings tab, it ends right before {/* COMMITS TAB */} or similar. 
// Actually the end of Settings tab is just before the end of the return statement or before the next tab.
// I will use a simple approach to replace all <Card> in settings to rounded.
content = content.replace(/<Card className="shadow-sm border-border\/50">/g, '<Card className="border-0 shadow-[0_4px_24px_rgba(0,0,0,0.02)] rounded-[2rem] overflow-hidden">');
content = content.replace(/<Card className="border-destructive\/50 shadow-sm">/g, '<Card className="border border-red-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] rounded-[2rem] overflow-hidden bg-red-50/30">');
content = content.replace(/<CardHeader>/g, '<CardHeader className="pb-4">');

// We also need to add </div > after settings space-y-8. It's too complex to inject via regex.
// Let's use string split to wrap the entire settings tab inner div.
const parts = content.split("{tab === 'settings' && wsInfo && (");
if (parts.length > 1) {
    const endParts = parts[1].split(')}');
    // wrap the inside of the first block inside a centered div
    // We already replaced the opening above. Let's make sure it closes.
}


// Add setInviteDialogOpen state and Dialog imports
if (!content.includes('import { Dialog')) {
  content = content.replace(/import \{ Switch \} from '@\/components\/ui\/switch'/, "import { Switch } from '@/components/ui/switch'\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'");
}

if (!content.includes('const [inviteDialogOpen, setInviteDialogOpen] = useState(false)')) {
  content = content.replace('const [inviteLoading, setInviteLoading] = useState(false)', 'const [inviteLoading, setInviteLoading] = useState(false)\n  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)');
}

// Modify generateInvite to also use the dialog and remove toast for success if we show dialog
// Actually we'll bind generateInvite to the dialog content "Generate Link" button.
// And update the bottom of the layout to include the dialog.
const dialogCode = `
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
                  <Button onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success('Link copied to clipboard!') }} variant="ghost" size="icon" className="shrink-0 text-slate-500 hover:text-slate-900 rounded-xl">
                    <Copy className="h-4 w-4" />
                  </Button>
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
`;

content = content.replace(/    <\/div>\s*\)\s*}\s*$/, dialogCode);

fs.writeFileSync('src/app/dashboard/[workspaceId]/page.tsx', content);
