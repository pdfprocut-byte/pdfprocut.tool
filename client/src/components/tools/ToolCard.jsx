import { Link } from 'react-router-dom';
import { FaArrowRight } from 'react-icons/fa';
import { resetTilt, trackTilt } from '../../lib/tiltMotion.js';
import { getToolCategoryClass } from '../../tools.js';

export default function ToolCard({ tool }) {
  const Icon = tool.icon;

  return <Link
    to={tool.disabled ? '#' : `/tools/${tool.slug}`}
    className={`tool-card text-decoration-none ${getToolCategoryClass(tool.category)}${tool.disabled ? ' disabled' : ''}`}
    onPointerMove={tool.disabled ? undefined : trackTilt}
    onPointerLeave={resetTilt}
  >
    <span className="tool-card-icon" aria-hidden="true"><Icon/></span>
    <span className="tool-card-arrow" aria-hidden="true"><FaArrowRight/></span>
    <h3>{tool.name}</h3>
    <p>{tool.description}</p>
    {tool.disabled && <small>Setup needed</small>}
  </Link>;
}
