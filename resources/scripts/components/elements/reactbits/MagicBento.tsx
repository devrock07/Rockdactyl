import React from 'react';
import './reactbits-suite.css';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
    glowColor?: string;
    particleCount?: number;
    enableStars?: boolean;
    enableTilt?: boolean;
    enableMagnetism?: boolean;
    clickEffect?: boolean;
};

// Keep the public props compatible without spawning particles, pointer trackers or GPU animations.
export const MagicBentoCard: React.FC<CardProps> = ({
    children,
    className = '',
    glowColor,
    particleCount,
    enableStars,
    enableTilt,
    enableMagnetism,
    clickEffect,
    ...props
}) => {
    void [glowColor, particleCount, enableStars, enableTilt, enableMagnetism, clickEffect];
    return (
        <div className={`magic-bento-card ${className}`} {...props}>
            {children}
        </div>
    );
};
export const MagicBentoGrid: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    children,
    className = '',
    ...props
}) => (
    <div className={`magic-bento-grid ${className}`} {...props}>
        {children}
    </div>
);
