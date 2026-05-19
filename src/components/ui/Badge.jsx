const variants = {
  solid: 'bg-black text-white',
  outline: 'bg-white text-black border border-[#E5E5E5]',
  muted: 'bg-[#F9F9F9] text-[#666]',
  'outline-dark': 'bg-transparent text-black border border-black',
}

export default function Badge({ children, variant = 'muted', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
