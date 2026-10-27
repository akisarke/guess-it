import { Link } from 'react-router-dom';

export interface StateCardAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface StateCardProps {
  badge: string;
  title: string;
  description: string;
  primaryAction?: StateCardAction;
  secondaryAction?: StateCardAction;
  retryAction?: () => void;
  role?: 'alert' | 'status';
  // drop the card chrome when the state already sits inside a card
  inline?: boolean;
}

export function StateCard({
  badge,
  title,
  description,
  primaryAction,
  secondaryAction,
  retryAction,
  role,
  inline = false,
}: StateCardProps) {
  const resolvedRole = role ?? (retryAction ? 'alert' : 'status');
  return (
    <div className={inline ? 'state-card state-card--inline' : 'state-card'} role={resolvedRole}>
      <span className="state-badge">{badge}</span>
      {inline ? <h2 className="state-title">{title}</h2> : <h1 className="state-title">{title}</h1>}
      <p className="state-description">{description}</p>
      {(primaryAction || secondaryAction || retryAction) && (
        <div className="state-actions">
          {primaryAction && (primaryAction.onClick ? (
            <button type="button" className="btn-primary state-btn-primary" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          ) : primaryAction.href ? (
            <Link to={primaryAction.href} className="btn-primary state-btn-primary">
              {primaryAction.label}
            </Link>
          ) : null)}
          {secondaryAction && (secondaryAction.onClick ? (
            <button type="button" className="btn-secondary state-btn-secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          ) : secondaryAction.href ? (
            <Link
              to={secondaryAction.href}
              onClick={secondaryAction.onClick}
              className="btn-secondary state-btn-secondary"
            >
              {secondaryAction.label}
            </Link>
          ) : null)}
          {!secondaryAction && retryAction ? (
            <button type="button" className="btn-secondary state-btn-secondary" onClick={retryAction}>
              {'Retry'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
