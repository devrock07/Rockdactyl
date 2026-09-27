import React from 'react';
import './react-bits-effects.css';

// Compatibility exports: existing callers now render quiet, accessible surfaces.
export const SplitText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
    <h1 className={`rb-split-text ${className}`}>{text}</h1>
);
export const ShinyText: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => <span className={`rb-shiny-text ${className}`}>{children}</span>;
export const AmbientCursor: React.FC = () => null;
export const TiltSpotlight: React.FC<React.HTMLAttributes<HTMLDivElement> & { spotlightColor?: string }> = ({
    children,
    className = '',
    spotlightColor,
    ...props
}) => {
    void spotlightColor;
    return (
        <div className={`rb-depth-card ${className}`} {...props}>
            {children}
        </div>
    );
};
export const BorderGlow: React.FC<
    React.HTMLAttributes<HTMLDivElement> & { glowColor?: string; spotlightColor?: string }
> = ({ children, className = '', glowColor, spotlightColor, ...props }) => {
    void glowColor;
    void spotlightColor;
    return (
        <div className={`rb-border-glow ${className}`} {...props}>
            <div className={'rb-border-content'}>{children}</div>
        </div>
    );
};
