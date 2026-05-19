export default function Input({ label, type = 'text', placeholder, value, onChange, className = '', required }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-black tracking-wide uppercase">{label}</label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-2xl text-sm text-black placeholder-[#999] outline-none focus:border-black focus:bg-white transition-colors duration-150"
      />
    </div>
  )
}
