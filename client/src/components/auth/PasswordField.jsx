import { useId, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

export default function PasswordField({ label, ...inputProps }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const action = visible ? 'Hide' : 'Show';
  return <div className="auth-password-field">
    <label htmlFor={id}>{label}</label>
    <div className="auth-password-control">
      <input type={visible ? 'text' : 'password'} id={id} {...inputProps}/>
      <button className="auth-password-toggle" type="button" aria-label={`${action} ${label.toLowerCase()}`} onClick={() => setVisible((previous) => !previous)}>
        {visible ? <FaEyeSlash aria-hidden="true"/> : <FaEye aria-hidden="true"/>}
      </button>
    </div>
  </div>;
}
