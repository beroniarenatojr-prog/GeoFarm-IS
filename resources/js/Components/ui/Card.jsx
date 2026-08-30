/**
 * Shared panel. The green-tinted border and header carry Tumauini's colour
 * onto every screen that uses a Card, rather than each page inventing its own.
 */
export default function Card({ children, className = '', title, action }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-green-100 bg-green-50/60 flex items-center justify-between gap-4">
          <h3 className="text-base font-bold text-[#006400]">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}
