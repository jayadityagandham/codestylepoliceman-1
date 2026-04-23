const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/[workspaceId]/page.tsx', 'utf-8');

// The regex should match from {tab === 'overview' && data && ( to the exact closing parenthesis.
// This is somewhat complex, but we can look for the next tab's opening.
const overviewStartStr = "{tab === 'overview' && data && (";
const commitsStartStr = "{tab === 'commits' && data && (";

const startIndex = content.indexOf(overviewStartStr);
const endIndex = content.indexOf(commitsStartStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newOverview = `{tab === 'overview' && data && (
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
                      <div className="flex-1 h-4 rounded-full bg-gradient-to-r from-pink-400 via-orange-400 to-emerald-400 shadow-inner relative overflow-hidden">
                         <div className="absolute top-0 right-0 h-full w-1/4 bg-white/20 backdrop-blur-sm" />
                      </div>
                      <div className="text-[12px] font-bold text-slate-900 px-2 whitespace-nowrap">{data.overview.avgCycleTimeSeconds ? Math.round(data.overview.avgCycleTimeSeconds/3600) + 'h Avg' : 'N/A'}</div>
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
                                <div className={\`absolute -bottom-1 -right-1 size-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm \${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-300' : 'bg-orange-400'}\`}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <Card className="border-0 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-[1.5rem] bg-white">
                  <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">Open Pull Requests</p>
                      <div className="p-1.5 bg-blue-50 rounded-xl text-blue-500"><GitPullRequest className="size-4" /></div>
                    </div>
                    <div>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-display font-bold text-slate-900">{data.overview.openPRs}</span>
                        {data.overview.openPRs > 0 && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md mb-1.5">-2%</span>}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Active PRs</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: '78%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">78%</span>
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
                        {data.overview.openIssues > 5 && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md mb-1.5">+14%</span>}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Backlog Items</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: '31%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">31%</span>
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
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md mb-1.5">-12%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Unresolved</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: '95%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">95%</span>
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
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md mb-1.5">+5%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">Active Branches</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: '54%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">54%</span>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>

          </div>
        )}

        `;

  const finalContent = content.substring(0, startIndex) + newOverview + content.substring(endIndex);
  fs.writeFileSync('src/app/dashboard/[workspaceId]/page.tsx', finalContent);
} else {
  console.error("Could not find overview section");
}
