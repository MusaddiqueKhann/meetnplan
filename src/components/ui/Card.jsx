export default function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-[#E5E5E5] shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${onClick ? 'cursor-pointer hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)] transition-shadow duration-200' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
