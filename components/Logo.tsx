
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 100 }) => {
  return (
    <div className={className} style={{ width: size * 2, height: size }}>
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 600 300" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Red Background for K */}
        <path 
          d="M 270 20 L 140 20 A 110 110 0 0 0 140 240 L 270 240 Z" 
          fill="#FF0000" 
        />
        
        {/* Yellow K */}
        <text 
          x="155" 
          y="225" 
          fontFamily="Arial, Helvetica, sans-serif" 
          fontSize="250" 
          fontWeight="bold" 
          fill="#FFFF00" 
          textAnchor="middle"
          letterSpacing="-10"
        >
          K
        </text>
        
        {/* Green D */}
        <text 
          x="365" 
          y="225" 
          fontFamily="Arial, Helvetica, sans-serif" 
          fontSize="250" 
          fontWeight="bold" 
          fill="#009900" 
          textAnchor="middle"
        >
          D
        </text>

        {/* Green E */}
        <text 
          x="515" 
          y="225" 
          fontFamily="Arial, Helvetica, sans-serif" 
          fontSize="250" 
          fontWeight="bold" 
          fill="#009900" 
          textAnchor="middle"
        >
          E
        </text>

        {/* Pharmaceutical Trading & Distribution */}
        <text 
          x="320" 
          y="285" 
          fontFamily="Arial, Helvetica, sans-serif" 
          fontSize="32" 
          fontWeight="bold" 
          fill="#009900" 
          textAnchor="middle"
        >
          Pharmaceutical Trading &amp; Distribution
        </text>
      </svg>
    </div>
  );
};
