export default function Badge({ children, variant = 'default', className = '' }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    green: 'bg-green-100 text-green-800 border border-green-200',
    blue: 'bg-blue-100 text-blue-800 border border-blue-200',
    purple: 'bg-purple-100 text-purple-800 border border-purple-200',
  }
  
  return <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>
}

