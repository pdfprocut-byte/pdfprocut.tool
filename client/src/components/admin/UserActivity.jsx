const formatTool = (name = 'PDF tool') => String(name).split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

export default function UserActivity({ activity, onClose }) {
  const { user, tools = [] } = activity;

  return <section className="admin-panel admin-user-activity">
    <div className="admin-section-head">
      <div><span className="admin-visitor-modal-kicker">TOOLS USED</span><h2>{user.name || 'User'}</h2><p>{user.email}</p></div>
      <button className="admin-secondary" onClick={onClose}>Close</button>
    </div>
    <div className="admin-tool-usage-list">
      {tools.map((tool) => <article key={tool._id}>
        <span className="admin-tool-usage-mark" aria-hidden="true">PDF</span>
        <b>{formatTool(tool._id)}</b>
        <span className="admin-tool-usage-count">{tool.uses} {tool.uses === 1 ? 'use' : 'uses'}</span>
      </article>)}
      {!tools.length && <p className="admin-empty">No PDF tools used yet.</p>}
    </div>
  </section>;
}
