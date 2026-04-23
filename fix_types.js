const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/[workspaceId]/page.tsx', 'utf-8');

// 1. Add loadingInsights state
if (!content.includes('const [loadingInsights, setLoadingInsights] = useState(false)')) {
  content = content.replace('const [inviteLoading, setInviteLoading] = useState(false)', 'const [inviteLoading, setInviteLoading] = useState(false)\n  const [loadingInsights, setLoadingInsights] = useState(false)');
}

// 2. Fix data.insights type errors by casting data to any in the insights block
content = content.replace(/\{!\(data as any\)\.insights/g, '{!(data as any).insights');
content = content.replace(/\{!\(data as any\)\.insights \|\| !\(data as any\)\.insights\.length/g, '{!(data as any).insights || !(data as any).insights.length');
// just completely replace the data.insights references in that block with (data as any).insights
content = content.replace(/!data \S\| !data.insights/g, '!data || !(data as any).insights');
content = content.replace(/data.insights.length === 0/g, '(data as any).insights.length === 0');
content = content.replace(/data.insights.map/g, '(data as any).insights.map');

// 3. Fix map parameters implicitly having any
content = content.replace(/insight \=\>/g, '(insight: any) =>');
content = content.replace(/\(tag, idx\) \=\>/g, '(tag: string, idx: number) =>');

fs.writeFileSync('src/app/dashboard/[workspaceId]/page.tsx', content);
