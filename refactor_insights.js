const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/[workspaceId]/page.tsx', 'utf-8');

const startStr = "{tab === 'insights' && (";
const endStr = "{tab === 'settings' && wsInfo && (";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newInsights = `{tab === 'insights' && (
          <div className="max-w-4xl mx-auto py-8 animate-in fade-in duration-500">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-[28px] font-display font-bold text-slate-900 tracking-tight">AI Insights</h2>
                <p className="text-[13px] text-slate-500 mt-1 font-medium">Actionable intelligence for your codebase</p>
              </div>
              <Button onClick={async () => {
                  if (loadingInsights || !token) return;
                  setLoadingInsights(true);
                  try {
                    const res = await fetch(\`/api/workspaces/\${workspaceId}/insights/generate\`, { method: 'POST', headers: { Authorization: \`Bearer \${token}\`} });
                    if (res.ok) { refetch(); toast.success('Insights generated successfully'); }
                  } catch { toast.error('Failed to generate insights'); }
                  finally { setLoadingInsights(false); }
                }} 
                disabled={loadingInsights}
                className="rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-[0_8px_16px_rgba(15,23,42,0.2)] px-6 h-11 font-bold text-[13px]">
                {loadingInsights ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Brain className="size-4 mr-2" />}
                Generate New Insights
              </Button>
            </div>

            {/* Content Area */}
            {(!data || !data.insights || data.insights.length === 0) ? (
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
                {data.insights.map((insight) => (
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
                              {new Date(insight.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <p className="text-[14px] leading-relaxed text-slate-600 mb-6">
                            {insight.content}
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
          </div>
        )}

        `;

  const finalContent = content.substring(0, startIndex) + newInsights + content.substring(endIndex);
  fs.writeFileSync('src/app/dashboard/[workspaceId]/page.tsx', finalContent);
} else {
  console.error("Could not find insights section");
}
