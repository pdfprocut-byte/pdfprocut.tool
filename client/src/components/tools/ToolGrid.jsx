import ToolCard from './ToolCard.jsx';

export default function ToolGrid({ tools }) {
  return <div className="tool-grid">{tools.map((tool) => <ToolCard key={tool.slug} tool={tool}/>)}</div>;
}
