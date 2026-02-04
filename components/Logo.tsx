
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 100 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Right Body Part (Cyan) */}
      <path 
        d="M340 250 L256 390" 
        stroke="#4CC9F0" 
        strokeWidth="135" 
        strokeLinecap="round" 
      />

      {/* Left Body Part (Pink) */}
      <path 
        d="M172 250 L256 390" 
        stroke="#F72585" 
        strokeWidth="135" 
        strokeLinecap="round" 
      />

      {/* Head (Blue) */}
      <circle cx="256" cy="100" r="70" fill="#3A86FF" />
    </svg>
  );
};
