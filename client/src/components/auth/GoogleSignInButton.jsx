import { useEffect, useRef, useState } from 'react';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const isGoogleSignInEnabled = Boolean(clientId);

export default function GoogleSignInButton({ onCredential, onError }) {
  const buttonRef = useRef(null);
  const credentialHandler = useRef(onCredential);
  const errorHandler = useRef(onError);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { credentialHandler.current = onCredential; }, [onCredential]);
  useEffect(() => { errorHandler.current = onError; }, [onError]);

  useEffect(() => {
    if (!clientId) return undefined;
    let active = true;
    const renderButton = () => {
      const identity = window.google?.accounts?.id;
      if (!identity || !buttonRef.current || !active) return;
      identity.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response.credential) {
            errorHandler.current?.(new Error('Google did not return a sign-in credential.'));
            return;
          }
          credentialHandler.current?.(response.credential);
        }
      });
      identity.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: Math.min(buttonRef.current.clientWidth || 340, 400)
      });
    };
    const handleError = () => { if (active) setLoadError('Google sign-in could not load. Check your connection and try again.'); };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      let script = document.getElementById('google-identity-services');
      if (!script) {
        script = document.createElement('script');
        script.id = 'google-identity-services';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderButton, { once: true });
      script.addEventListener('error', handleError, { once: true });
    }

    return () => { active = false; };
  }, []);

  if (!clientId) return <p className="auth-google-note">Google sign-in needs a Google OAuth client ID in the client environment.</p>;
  return <div className="auth-google-control">
    <div className="auth-google-button" ref={buttonRef}/>
    {loadError && <p className="auth-inline-error" role="status">{loadError}</p>}
  </div>;
}
