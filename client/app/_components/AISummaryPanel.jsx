'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLatestSummary, generateSummary } from './aiSummaryApi';
import './AISummaryPanel.css';

export default function AISummaryPanel({ organizationId }) {
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  // -------- Query: latest summary --------
  const {
    data: summary,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['aiSummary', organizationId],
    queryFn: () => fetchLatestSummary(organizationId),
    enabled: !!organizationId,
    refetchInterval: 30000, // refresh every 30 seconds
    staleTime: 10000,
  });

  // -------- Mutation: generate new summary --------
  const mutation = useMutation({
    mutationFn: () => generateSummary(organizationId),
    onMutate: () => setError(null),
    onSuccess: (newSummary) => {
      queryClient.setQueryData(['aiSummary', organizationId], newSummary);
      refetch();
    },
    onError: (err) => {
      setError(err.message || 'Failed to generate summary. Please try again.');
    },
  });

  const handleGenerate = () => mutation.mutate();

  const handleDismissError = () => setError(null);

  // -------- Formatting Helpers --------
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  // -------- Loading State --------
  if (isLoading) {
    return (
      <div className="ai-summary-panel loading">
        <div className="spinner-container">
          <div className="spinner"></div>
          <span>Loading engineering health summary...</span>
        </div>
      </div>
    );
  }
// -------- Data normalization --------
  // The backend stores snake_case fields (key_metrics, top_contributors).
  // Tolerate camelCase too in case a future transform layer is added.
  const km = summary ? summary.key_metrics || summary.keyMetrics || {} : {};
  const metric = (camel, snake) => km[camel] ?? km[snake] ?? 0;
  const topContributors = summary
    ? summary.top_contributors || summary.topContributors || []
    : [];
  const risksArr = summary ? summary.risks || [] : [];
  const recs = summary ? summary.recommendations || [] : [];

  return (
    <div className="ai-summary-panel">

      {/* HEADER */}
      <div className="panel-header">
        <div className="panel-title">
          <h2>📊 Engineering Health Summary</h2>
          <span className="subtitle">AI-powered weekly report</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={mutation.isPending}
          className={`generate-button ${mutation.isPending ? 'loading' : ''}`}
        >
          {mutation.isPending ? (
            <>
              <span className="spinner-small"></span>
              Generating...
            </>
          ) : (
            '🔄 Generate Summary'
          )}
        </button>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="error-message">
          <div className="error-icon">🌐</div>
          <div className="error-text">{error}</div>
          <button onClick={handleDismissError} className="error-dismiss">
            Dismiss
          </button>
        </div>
      )}

      {/* EMPTY STATE (no summary exists yet) */}
      {!summary && !isLoading && !error && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No Summary Generated Yet</h3>
          <p>Click the &quot;Generate Summary&quot; button to create your first report.</p>
          <p className="hint">We&apos;ll analyze your team&apos;s GitHub, Slack, and Jira activity.</p>
        </div>
      )}

      {/* SUMMARY CONTENT */}
      {summary && (
        <div className="summary-content">

          {/* Meta info */}
          <div className="summary-meta">
            <span className="meta-item">📅 {formatDate(summary.generatedAt)}</span>
            <span className="badge">Weekly Report</span>
            <span className="badge secondary">AI Generated</span>
          </div>

          {/* Summary text */}
          <div className="summary-section summary-text">
            <h3>📝 Executive Summary</h3>
            <p>{summary.summary}</p>
          </div>

          {/* Key Metrics */}
          <div className="summary-section key-metrics">
            <h3>📊 Key Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-label">PRs Merged</span>
                <span className="metric-value">{metric('prsMerged', 'prs_merged')}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">PRs Opened</span>
                <span className="metric-value">{metric('prsOpened', 'prs_opened')}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Active Developers</span>
                <span className="metric-value">{metric('activeDevelopers', 'active_developers')}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Jira Issues Done</span>
                <span className="metric-value">{metric('jiraIssuesCompleted', 'jira_issues_completed')}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Jira Issues Created</span>
                <span className="metric-value">{metric('jiraIssuesCreated', 'jira_issues_created')}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Slack Messages</span>
                <span className="metric-value">{metric('slackMessages', 'slack_messages')}</span>
              </div>
            </div>
          </div>

          {/* Contributors */}
          {topContributors.length > 0 && (
            <div className="summary-section contributors">
              <h3>🏆 Top Contributors</h3>
              <ul className="contributors-list">
                {topContributors.map((contributor, idx) => (
                  <li key={idx} className="contributor-item">
                    <span className="contributor-avatar">👤</span>
                    {contributor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {risksArr.length > 0 && (
            <div className="summary-section risks">
              <h3>⚠️ Risks & Blockers</h3>
              <ul className="risks-list">
                {risksArr.map((risk, idx) => (
                  <li key={idx} className="risk-item">
                    <span className="risk-icon">🔴</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <div className="summary-section recommendations">
              <h3>💡 Recommendations</h3>
              <ul className="recommendations-list">
                {recs.map((rec, idx) => (
                  <li key={idx} className="recommendation-item">
                    <span className="rec-icon">✅</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer */}
          <div className="summary-footer">
            <button onClick={() => refetch()} className="refresh-button">
              🔄 Refresh
            </button>
            <span className="summary-id">
              Report ID: {summary._id ? summary._id.toString().slice(0, 8) : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}