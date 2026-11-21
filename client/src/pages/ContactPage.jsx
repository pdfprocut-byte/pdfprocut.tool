import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCheck, FaEnvelopeOpenText, FaPaperPlane } from 'react-icons/fa';
import { contactLimits, contactTopics } from '../../../shared/contact.mjs';
import { apiRequest } from '../lib/authApi.js';
import '../styles/infoPages.css';
import '../styles/contentPages.css';

export default function ContactPage() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setSending(true);
    setSent(false);
    setError('');
    try {
      await apiRequest('contact', { method: 'POST', body });
      form.reset();
      setSent(true);
    } catch (requestError) {
      setError(!requestError.status || requestError.message === 'Authentication request failed.'
        ? 'Could not send your message. Please try again.'
        : requestError.message);
    } finally {
      setSending(false);
    }
  }

  return <main className="contact-page">
    <div className="container contact-page-inner">
      <section className="contact-intro" aria-labelledby="contact-title">
        <h1 id="contact-title">Contact support</h1>
        <p>Send a message to the PDF Pro Cut administrator about a tool, your account, or an idea.</p>
        <Link to="/guides" className="contact-guides-link">Browse tool guides</Link>
        <div className="contact-art" aria-hidden="true"><div className="contact-art-card"><FaEnvelopeOpenText/></div></div>
      </section>

      <section className="contact-form-panel" aria-labelledby="contact-form-title">
        <div className="contact-form-heading"><h2 id="contact-form-title">Send a message</h2><p>Use the email address where you’d like a reply.</p></div>
        <form className="contact-form" onSubmit={handleSubmit}>
          <fieldset disabled={sending}>
            <div className="contact-form-row">
              <label>Full name<input name="name" autoComplete="name" type="text" placeholder="Your name" maxLength={contactLimits.name} required/></label>
              <label>Email address<input name="email" autoComplete="email" type="email" placeholder="you@example.com" maxLength={contactLimits.email} required/></label>
            </div>
            <label>Topic<select name="topic" defaultValue="" required>
              <option value="" disabled>Select a topic</option>
              {contactTopics.map((topic) => <option key={topic}>{topic}</option>)}
            </select></label>
            <label>Your message<textarea name="message" rows="5" placeholder="How can we help?" maxLength={contactLimits.message} required/></label>
            <button type="submit" className="contact-submit"><FaPaperPlane aria-hidden="true"/> {sending ? 'Sending…' : 'Send message'}</button>
          </fieldset>
          {error && <p className="auth-error contact-error" role="alert">{error}</p>}
          {sent && <div className="contact-success" role="status">
            <span><FaCheck aria-hidden="true"/></span>
            <div><b>Message sent</b><p>Your message is in the administrator’s inbox.</p></div>
          </div>}
        </form>
      </section>
    </div>
  </main>;
}
