import { useState } from 'react'
import { CheckCircle2, Chrome, Globe, Loader2, AlertCircle, Link2, Copy, FolderOpen } from 'lucide-react'
import { useScrapeMonitor } from '../hooks/useScrapeMonitor'
import type { ScrapeJob } from '../functions/scrapeServer'
import { LAUNCH_CHROME_CAVEAT, MANUAL_EXTENSION_STEPS } from '../functions/extensionInstall'

function statusIcon(status: ScrapeJob['status']) {
  if (status === 'done') return <CheckCircle2 size={14} className="scrape-status-icon done" />
  if (status === 'error') return <AlertCircle size={14} className="scrape-status-icon error" />
  if (status === 'queued') return <Loader2 size={14} className="scrape-status-icon spin" />
  return <Loader2 size={14} className="scrape-status-icon spin active" />
}

function statusLabel(status: ScrapeJob['status']) {
  switch (status) {
    case 'queued': return 'Queued'
    case 'loading': return 'Loading page'
    case 'scrolling': return 'Scrolling'
    case 'extracting': return 'Extracting'
    case 'running': return 'Running'
    case 'done': return 'Done'
    case 'error': return 'Error'
    default: return status
  }
}

export default function ScrapePanel({ serverConnected }: { serverConnected: boolean }) {
  const {
    connected,
    extensionConnected,
    jobs,
    lastEvent,
    launchMessage,
    extensionPath,
    pathCopied,
    launchBrowser,
    queueUrls,
    copyPath,
    openExtensionFolder
  } = useScrapeMonitor(serverConnected)
  const [urlInput, setUrlInput] = useState('')
  const [showManual, setShowManual] = useState(true)

  const handleQueue = () => {
    const urls = urlInput.split('\n').map((l) => l.trim()).filter(Boolean)
    void queueUrls(urls)
    if (urls.length) setUrlInput('')
  }

  return (
    <div className="scrape-panel">
      <div className="scrape-toolbar">
        <button type="button" className="btn-primary scrape-launch-btn" onClick={() => void launchBrowser()}>
          <Chrome size={16} />
          Launch Chrome
        </button>
        <p className="scrape-hint warn">{LAUNCH_CHROME_CAVEAT}</p>
        <div className="scrape-status-row">
          <span className={`scrape-pill ${connected ? 'ok' : 'bad'}`}>Server {connected ? 'on' : 'off'}</span>
          <span className={`scrape-pill ${extensionConnected ? 'ok' : 'bad'}`}>Extension {extensionConnected ? 'on' : 'off'}</span>
        </div>
        {launchMessage ? (
          <div className={`scrape-hint ${launchMessage.includes('Failed') || launchMessage.includes('only available') ? 'error' : ''}`}>
            {launchMessage}
          </div>
        ) : null}
        {lastEvent ? <div className="scrape-hint">Latest: {lastEvent}</div> : null}
      </div>

      <div className="scrape-manual-box">
        <button type="button" className="scrape-manual-toggle" onClick={() => setShowManual((v) => !v)}>
          Manual install in your signed-in Chrome (recommended)
        </button>
        {showManual ? (
          <div className="scrape-manual-body">
            <ol className="scrape-manual-steps">
              {MANUAL_EXTENSION_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {extensionPath ? (
              <code className="scrape-path" title={extensionPath}>{extensionPath}</code>
            ) : (
              <p className="scrape-hint">Extension path available when running in Electron.</p>
            )}
            <div className="scrape-manual-actions">
              <button type="button" className="btn-secondary scrape-mini-btn" onClick={() => void copyPath()} disabled={!extensionPath}>
                <Copy size={14} />
                {pathCopied ? 'Copied!' : 'Copy folder path'}
              </button>
              <button type="button" className="btn-secondary scrape-mini-btn" onClick={() => void openExtensionFolder()} disabled={!extensionPath}>
                <FolderOpen size={14} />
                Open folder
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="scrape-queue-form">
        <label className="scrape-label">
          URLs to scrape (one per line — server can also push jobs)
          <textarea
            className="scrape-textarea"
            rows={3}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://holidayz.makemytrip.com/holidays/india/search?..."
          />
        </label>
        <button type="button" className="btn-primary" onClick={handleQueue} disabled={!urlInput.trim()}>
          <Globe size={16} />
          Queue scrape jobs
        </button>
      </div>

      <div className="scrape-jobs">
        <div className="scrape-jobs-title">Live extraction flow</div>
        {jobs.length === 0 ? (
          <div className="scrape-empty">No jobs yet. Install the extension in your Chrome, then queue URLs from here.</div>
        ) : (
          jobs.map((job) => (
            <div key={job.jobId} className={`scrape-job-card status-${job.status}`}>
              <div className="scrape-job-head">
                {statusIcon(job.status)}
                <span className="scrape-job-status">{statusLabel(job.status)}</span>
                {job.hasCapture ? <span className="scrape-badge">HTML saved</span> : null}
              </div>
              <div className="scrape-job-url" title={job.extractedUrl || job.url}>
                <Link2 size={12} />
                {job.extractedUrl || job.url}
              </div>
              {job.message ? <div className="scrape-job-msg">{job.message}</div> : null}
              {job.error ? <div className="scrape-job-error">{job.error}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
