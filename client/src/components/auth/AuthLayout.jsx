import { Link } from 'react-router-dom';
import '../../styles/auth.css';

export default function AuthLayout({ variant, title, intro, children }) {
  return <main className={`auth-page auth-page-${variant} auth-premium`}>
    <div className="auth-split">
      <div className="auth-artwork" aria-hidden="true">
        <img src="/auth-document-tray-clean.png" width="1254" height="1254" alt="" fetchPriority="high"/>
        <div className="auth-flying-pages">
          {[
            { format: 'PDF', kind: 'pdf', x: '-17%', y: '-9%', angle: '-13deg', stackX: '-3px', stackY: '2px', stackAngle: '-8deg', delay: '0ms' },
            { format: 'WORD', kind: 'word', x: '-8%', y: '-16%', angle: '8deg', stackX: '-1px', stackY: '1px', stackAngle: '-8deg', delay: '70ms' },
            { format: 'IMAGE', kind: 'image', x: '17%', y: '-10%', angle: '15deg', stackX: '0px', stackY: '0px', stackAngle: '-8deg', delay: '140ms' },
            { format: 'EXCEL', kind: 'excel', x: '-16%', y: '8%', angle: '-20deg', stackX: '1px', stackY: '-1px', stackAngle: '-8deg', delay: '210ms' },
            { format: 'PPT', kind: 'ppt', x: '16%', y: '8%', angle: '19deg', stackX: '3px', stackY: '-2px', stackAngle: '-8deg', delay: '280ms' }
          ].map(({ format, kind, x, y, angle, stackX, stackY, stackAngle, delay }, index) => <span
            className={`auth-flying-page auth-flying-page-${kind}`}
            key={kind}
            style={{
              '--page-x': x,
              '--page-y': y,
              '--page-angle': angle,
              '--stack-x': stackX,
              '--stack-y': stackY,
              '--stack-angle': stackAngle,
              '--page-delay': delay,
              zIndex: index + 1
            }}
          >
            <span className="auth-page-format">{format}</span>
            <span className="auth-page-lines"><i/><i/><i/><i/></span>
            <span className="auth-page-table"/>
          </span>)}
        </div>
      </div>
      <section className="auth-card" aria-labelledby={`${variant}-title`}>
        <Link className="auth-brand" to="/">PDF <span>Pro Cut</span></Link>
        <h1 id={`${variant}-title`}>{title}</h1>
        <p className="auth-intro">{intro}</p>
        {children}
      </section>
    </div>
  </main>;
}