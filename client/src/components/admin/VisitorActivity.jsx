import { createPortal } from 'react-dom';

export default function VisitorActivity({ visitor, activity, onClose }) {
  const visits = activity.items || [];
  const label = visitor.user?.name || 'Guest visitor';
  return createPortal(<div className="admin-visitor-modal-backdrop" role="presentation" onClick={onClose}>
    <section className="admin-panel admin-visitor-modal" role="dialog" aria-modal="true" aria-labelledby="admin-visitor-modal-title" onClick={(event) => event.stopPropagation()}>
      <div className="admin-section-head">
        <div>
          <span className="admin-visitor-modal-kicker">VISITOR DETAILS</span>
          <h2 id="admin-visitor-modal-title">{label}</h2>
          <p>{visitor.visitorId ? `Visitor ID ${visitor.visitorId}` : 'Guest visitor'} · {activity.total || 0} page views this month</p>
        </div>
        <button type="button" className="admin-secondary" onClick={onClose}>Close</button>
      </div>
      <section className="admin-table-wrap admin-visitor-detail-table">
        <table>
          <thead><tr><th>Visited at</th><th>Page</th><th>Country</th><th>Source</th></tr></thead>
          <tbody>{visits.map((visit) => <tr key={visit._id}>
            <td className="admin-visit-date">{new Date(visit.createdAt).toLocaleString()}</td>
            <td><span className="admin-visit-path">{visit.path || '/'}</span></td>
            <td>{visit.country && visit.country !== 'UN' ? visit.country : 'Unknown'}</td>
            <td>{visit.source === 'internal' ? 'Internal navigation' : visit.source || 'direct'}</td>
          </tr>)}{!visits.length && <tr><td colSpan="4" className="admin-visit-empty">No page views found for this visitor.</td></tr>}</tbody>
        </table>
      </section>
      {activity.total > visits.length && <p className="admin-visitor-modal-note">Showing the latest {visits.length} of {activity.total} page views.</p>}
    </section>
  </div>, document.body);
}
