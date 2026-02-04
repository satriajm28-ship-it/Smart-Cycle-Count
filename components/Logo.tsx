
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
      viewBox="0 0 500 500" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Glow effects */}
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="15" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Head / Circle */}
      <circle cx="250" cy="130" r="50" fill="#00A3FF" filter="url(#glow)" />
      
      {/* Pink Shape (Left) */}
      <rect 
        x="235" 
        cy="225" 
        width="80" 
        height="180" 
        rx="40" 
        transform="rotate(45 235 225)" 
        fill="#FF007A" 
        filter="url(#glow)" 
      />
      
      {/* Cyan Shape (Right) */}
      <rect 
        x="265" 
        cy="225" 
        width="80" 
        height="180" 
        rx="40" 
        transform="rotate(-45 265 225)" 
        fill="#00E0FF" 
        filter="url(#glow)" 
      />
    </svg>
  );
};
