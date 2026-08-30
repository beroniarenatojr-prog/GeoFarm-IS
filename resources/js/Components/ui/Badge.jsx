/**
 * Small status pill.
 *
 * The neutral variants are all tints of Tumauini green, separated by depth
 * rather than by hue, so a screen full of badges still reads as one palette.
 * `red` and `yellow` stay off-palette on purpose: they mean failed and
 * pending, and colour is doing real work there.
 *
 * The blue/purple names are kept because callers already use them; they now
 * paint green. Prefer the semantic aliases below in new code.
 */
export default function Badge({ children, variant = 'default', className = '' }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

  const variants = {
    default: 'bg-gray-100 text-gray-800',

    green:   'bg-green-100 text-green-900 border border-green-200',
    emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    lime:    'bg-lime-100 text-lime-800 border border-lime-200',
    deep:    'bg-[#006400] text-white',

    red:     'bg-red-100 text-red-800 border border-red-200',
    yellow:  'bg-amber-100 text-amber-800 border border-amber-200',
  }

  // Legacy names, mapped onto distinct greens so they stay tellable apart.
  variants.blue = variants.emerald
  variants.purple = variants.lime

  return <span className={`${base} ${variants[variant] ?? variants.default} ${className}`}>{children}</span>
}
