import React from 'react';

const names = new Set([
    'overview',
    'servers',
    'nodes',
    'users',
    'settings',
    'api',
    'databases',
    'locations',
    'files',
    'console',
    'schedules',
    'backups',
    'network',
    'startup',
    'activity',
    'admin',
    'nests',
    'mounts',
]);

export default ({ name }: { name?: string }) => {
    const aliases: Record<string, string> = { account: 'users', 'api credentials': 'api', 'ssh keys': 'api' };
    const normalized = (name || 'overview').toLowerCase();
    const key = aliases[normalized] || normalized;
    return (
        <svg
            width={20}
            height={20}
            viewBox={'0 0 24 24'}
            fill={'none'}
            stroke={'currentColor'}
            strokeWidth={1.7}
            strokeLinecap={'round'}
            strokeLinejoin={'round'}
            aria-hidden={'true'}
            focusable={'false'}
        >
            <use href={`/themes/pterodactyl/icons/navigation.svg#${names.has(key) ? key : 'overview'}`} />
        </svg>
    );
};
