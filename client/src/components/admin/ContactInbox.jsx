export default function ContactInbox({ inbox, busy, onPageChange }) {
  const { items = [], total = 0, page = 1, pages = 1 } = inbox || {};

  return <div className="admin-content">
    <section className="admin-panel admin-inbox" aria-label="Contact messages" aria-busy={busy}>
      <div className="admin-section-head">
        <div>
          <h2>Contact inbox</h2>
          <p>{inbox ? `${total} ${total === 1 ? 'message' : 'messages'} from the Contact page` : 'Messages from the Contact page'}</p>
        </div>
      </div>
      {items.map((item) => <details className="admin-inbox-message" key={item._id}>
        <summary>
          <span><strong>{item.topic}</strong><small>{item.name}</small></span>
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        </summary>
        <div className="admin-inbox-body">
          <p>{item.message}</p>
          <a href={`mailto:${encodeURIComponent(item.email)}`}>Reply to {item.email}</a>
        </div>
      </details>)}
      {!items.length && <p className="admin-empty">{busy ? 'Loading messages…' : inbox ? 'No messages yet.' : 'Use Refresh to load messages.'}</p>}
      {pages > 1 && <nav className="admin-inbox-pagination" aria-label="Message pages">
        <button type="button" className="admin-secondary" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" className="admin-secondary" disabled={busy || page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
      </nav>}
    </section>
  </div>;
}
