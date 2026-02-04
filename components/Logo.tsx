
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
      {/* Head - Blue Circle at the top */}
      <circle 
        cx="256" 
        cy="120" 
        r="60" 
        fill="#329EFD" 
      />
      
      {/* Right side body - Cyan Pill (Underneath) */}
      <g transform="translate(351, 305) rotate(45)">
        <rect 
          x="-55" 
          y="-135" 
          width="110" 
          height="270" 
          rx="55" 
          fill="#3ED4F7" 
        />
      </g>
      
      {/* Left side body - Pink Pill (On Top) */}
      <g transform="translate(161, 305) rotate(-45)">
        <rect 
          x="-55" 
          y="-135" 
          width="110" 
          height="270" 
          rx="55" 
          fill="#F93F77" 
        />
      </g>
    </svg>
  );
};
