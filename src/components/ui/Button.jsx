const variants = {
  solid: 'bg-black text-white hover:bg-neutral-800 active:bg-neutral-900',
  ghost: 'bg-transparent text-black border border-[#E5E5E5] hover:bg-[#F9F9F9] active:bg-neutral-100',
  outline: 'bg-transparent text-black border border-black hover:bg-black hover:text-white',
  pill: 'rounded-full bg-transparent text-black border border-[#E5E5E5] hover:bg-black hover:text-white',
  'pill-active': 'rounded-full bg-black text-white',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-sm font-semibold',
  xl: 'px-8 py-4 text-base font-semibold',
}

export default function Button({ children, variant = 'solid', size = 'md', className = '', onClick, type = 'button', disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-2xl
        transition-all duration-150 cursor-pointer select-none
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {children}
    </button>
  )
}
