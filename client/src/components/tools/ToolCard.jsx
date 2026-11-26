import { Link } from 'react-router-dom';
import { FaArrowRight } from 'react-icons/fa';
import { resetTilt, trackTilt } from '../../lib/tiltMotion.js';
import { getToolCategoryClass } from '../../tools.js';

export default function ToolCard({ tool }) {
  const Icon = tool.icon;
  const cardContent = <>
    <span className="tool-card-icon" aria-hidden="true"><Icon/></span>
    {!tool.comingSoon && <span className="tool-card-arrow" aria-hidden="true"><FaArrowRight/></span>}
    <h3>{tool.name}</h3>
    <p>{tool.description}</p>
    {tool.comingSoon && <small className="tool-card-status">Coming Soon</small>}
    {tool.disabled && <small>Setup needed</small>}
  </>;

  if (tool.comingSoon) {
    return <article
      className={`tool-card text-decoration-none coming-soon ${getToolCategoryClass(tool.category)}`}
      aria-label={`${tool.name}: Coming Soon`}
    >{cardContent}</article>;
  }

  return <Link
    to={tool.disabled ? '#' : `/tools/${tool.slug}`}
    className={`tool-card text-decoration-none ${getToolCategoryClass(tool.category)}${tool.disabled ? ' disabled' : ''}`}
    onPointerMove={tool.disabled ? undefined : trackTilt}
    onPointerLeave={resetTilt}
  >
    {cardContent}
  </Link>;
}
