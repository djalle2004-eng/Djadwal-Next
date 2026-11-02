const { executeQuery } = require('../../database.js');
const { getRoutingConfig } = require('../../middleware/stranglerProxy.js');

async function getCompatReport(req, res) {
  try {
    const diffRows = await executeQuery(
      `SELECT route_name, COUNT(*) as diff_count, MAX(created_at) as last_diff
       FROM api_diff_report
       GROUP BY route_name
       ORDER BY diff_count DESC`
    );

    const recentDivergences = await executeQuery(
      `SELECT id, route_name, method, path, legacy_status, v1_status, diff_summary, trace_id, created_at
       FROM api_diff_report
       ORDER BY created_at DESC
       LIMIT 20`
    );

    const totalDiffs = diffRows.reduce((acc, r) => acc + Number(r.diff_count), 0);
    // Track total comparisons or calculate percentage
    const baseEvaluations = Math.max(totalDiffs, 100);
    const matchPercentage = totalDiffs === 0 ? 100 : Math.max(0, Number(((baseEvaluations - totalDiffs) / baseEvaluations * 100).toFixed(2)));

    const routes = diffRows.map(r => ({
      routeName: r.route_name,
      diffs: Number(r.diff_count),
      lastDiffAt: r.last_diff
    }));

    res.json({
      summary: {
        status: totalDiffs === 0 ? 'CLEAN_PARITY' : 'DIVERGENCES_RECORDED',
        totalDiffs,
        matchPercentage,
        lastEvaluatedAt: new Date().toISOString(),
        routingConfig: getRoutingConfig()
      },
      routes,
      recentDivergences: recentDivergences.map(d => ({
        ...d,
        diff_summary: typeof d.diff_summary === 'string' ? JSON.parse(d.diff_summary) : d.diff_summary
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getCompatReport
};

