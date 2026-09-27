import React from 'react';
import Avatar from '@/components/Avatar';
import FluidGlass from '@/components/elements/reactbits/FluidGlass';

import './reactbits-suite.css';

type Props = {
    name: string;
    title: string;
    handle: string;
    status: string;
    detail?: string;
    actionText?: string;
    onActionClick?: () => void;
};

export default ({ name, title, handle, status, detail, actionText = 'API keys', onActionClick }: Props) => {
    return (
        <div className={'rb-profile-shell'}>
            <FluidGlass className={'rb-profile-card'} intensity={'strong'}>
                <div className={'rb-profile-grid'} aria-hidden={'true'} />
                <div className={'rb-profile-avatar'}>
                    <Avatar.User size={94} />
                </div>
                <div className={'rb-profile-copy'}>
                    <span className={'rb-profile-kicker'}>{title}</span>
                    <h1>{name}</h1>
                    <p>@{handle}</p>
                    {!!detail && <span className={'rb-profile-detail'}>{detail}</span>}
                </div>
                <div className={'rb-profile-actions'}>
                    <span className={'rb-profile-status'}>
                        <i /> {status}
                    </span>
                    {!!onActionClick && (
                        <button type={'button'} onClick={onActionClick}>
                            {actionText}
                        </button>
                    )}
                </div>
            </FluidGlass>
        </div>
    );
};
