'use client';

import { useState } from 'react';
import {
  FileText,
  Image,
  Film,
  Music,
  Download,
  ExternalLink,
  File,
  FileSpreadsheet,
  Presentation,
  FileType2,
  Loader2,
} from 'lucide-react';
import Lightbox from './Lightbox';

/**
 * Renders a mirrored Slack attachment according to its MIME category:
 * image → preview + lightbox, video → HTML5 player, audio → audio player,
 * document/other → download card. Never exposes Slack's private URLs — only
 * the PulseOps-mirrored storageUrl (or a pending state while the worker
 * finishes the mirror).
 */
function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function extensionIcon(name = '') {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="h-5 w-5" />;
  if (['ppt', 'pptx'].includes(ext)) return <Presentation className="h-5 w-5" />;
  if (['txt', 'md', 'log', 'json', 'yaml', 'yml', 'ts', 'js', 'py', 'go', 'java', 'c', 'cpp'].includes(ext)) {
    return <FileType2 className="h-5 w-5" />;
  }
  if (['pdf'].includes(ext)) return <FileText className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

export default function AttachmentCard({ attachment }) {
  const [lightbox, setLightbox] = useState(false);
  const { category, url, name, mimeType, sizeBytes, id } = attachment;

  if (!category || category === 'other') {
    return (
      <div className="mt-2 inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
          {extensionIcon(name)}
        </span>
        <div className="min-w-0">
          <p className="max-w-xs truncate text-sm font-medium text-slate-800">{name || `file-${id}`}</p>
          {sizeBytes ? <p className="text-xs text-slate-500">{formatSize(sizeBytes)}</p> : null}
        </div>
        {url ? (
          <div className="flex items-center gap-1.5 pl-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
            <a
              href={url}
              download
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Mirroring…
          </span>
        )}
      </div>
    );
  }

  if (category === 'image') {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => url && setLightbox(true)}
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
          title={name}
        >
          {url ? (
            <img
              src={url}
              alt={name || 'Shared image'}
              className="max-h-72 w-full object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Image being mirrored…
            </div>
          )}
        </button>
        {url && lightbox && (
          <Lightbox src={url} alt={name} onClose={() => setLightbox(false)} />
        )}
      </div>
    );
  }

  if (category === 'video') {
    return url ? (
      <video
        controls
        preload="metadata"
        className="mt-2 max-h-80 rounded-xl border border-slate-200 bg-slate-950"
        src={url}
      >
        Your browser does not support video playback.
      </video>
    ) : (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        <Film className="h-4 w-4" />
        Video is being mirrored…
      </div>
    );
  }

  if (category === 'audio') {
    return url ? (
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <Music className="h-4 w-4 shrink-0 text-slate-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{name || 'Audio'}</p>
          <audio controls preload="metadata" className="mt-1 w-full" src={url}>
            Your browser does not support audio playback.
          </audio>
        </div>
      </div>
    ) : (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Audio is being mirrored…
      </div>
    );
  }

  return null;
}