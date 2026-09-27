import React from 'react';
import './reactbits-suite.css';

type Props = React.HTMLAttributes<HTMLDivElement> & { intensity?: 'soft' | 'strong' };

export default ({ children, className = '', intensity = 'soft', ...props }: Props) => (
    <div className={`rb-fluid-glass rb-fluid-glass-${intensity} ${className}`} {...props}>
        <div className={'rb-fluid-content'}>{children}</div>
    </div>
);
