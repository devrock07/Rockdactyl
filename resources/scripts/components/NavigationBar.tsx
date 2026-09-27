import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faCogs, faLayerGroup, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import SearchContainer from '@/components/dashboard/search/SearchContainer';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import http from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import Avatar from '@/components/Avatar';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import useFlash from '@/plugins/useFlash';

const RightNavigation = styled.div`
    flex: 0 0 auto;

    & > a,
    & > button,
    & > .navigation-link {
        ${tw`flex items-center justify-center no-underline cursor-pointer transition-all duration-150`};
        width: 2.35rem;
        height: 2.35rem;
        margin-left: 0.35rem;
        color: var(--shell-muted);
        border: 1px solid var(--shell-border);
        border-radius: 8px;
        background: var(--shell-panel);
        box-shadow: none;
        backdrop-filter: none;

        &:active,
        &:hover {
            color: var(--shell-text);
            border-color: var(--shell-border-strong);
            background: var(--shell-panel);
            box-shadow: none;
        }

        @media (hover: hover) and (pointer: fine) {
            &:hover {
                transform: none;
            }
        }
    }

    & > a.active {
        color: var(--shell-accent-bright);
        border-color: rgba(var(--shell-accent-rgb), 0.42);
        background: var(--shell-accent-soft);
    }

    & > .search-trigger {
        width: 16rem;
        padding: 0 0.75rem;
        justify-content: flex-start;
        gap: 0.65rem;
        color: #737a91;

        .search-copy {
            overflow: hidden;
            flex: 1;
            font-size: 0.76rem;
            text-align: left;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        kbd {
            padding: 0.16rem 0.42rem;
            color: #80879c;
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.035);
            font-size: 0.62rem;
        }
    }

    @media (max-width: 800px) {
        & > a,
        & > button,
        & > .navigation-link {
            width: 2.75rem;
            height: 2.75rem;
            margin-left: 0.2rem;
        }

        & > .search-trigger {
            width: 2.75rem;
            padding: 0;
            justify-content: center;

            .search-copy,
            kbd {
                display: none;
            }
        }
    }

    @media (max-width: 420px) {
        & > a,
        & > button,
        & > .navigation-link,
        & > .search-trigger {
            width: 2.75rem;
            height: 2.75rem;
            margin-left: 0.15rem;
            backdrop-filter: none;
        }
    }
`;

const Topbar = styled.div.attrs({ className: 'rock-topbar' as string })`
    position: relative;
    border-bottom: 1px solid var(--shell-border);
    background: var(--shell-panel);
    box-shadow: none;
    backdrop-filter: none;

    &::after {
        position: absolute;
        right: 12%;
        bottom: -1px;
        left: 12%;
        height: 1px;
        content: '';
        pointer-events: none;
        background: var(--shell-panel);
    }

    .brand-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        margin-right: 0.6rem;
        color: var(--shell-accent-bright);
        border: 1px solid rgba(var(--shell-accent-rgb), 0.44);
        border-radius: 6px;
        background: rgba(var(--shell-accent-rgb), 0.09);
        font-size: 0.72rem;
    }

    .brand-logo {
        width: 1.75rem;
        height: 1.75rem;
        margin-right: 0.6rem;
        flex: 0 0 auto;
        border-radius: 6px;
        object-fit: contain;
    }

    .brand-mark {
        flex: 0 0 auto;
    }

    .brand-name {
        color: var(--shell-text);
        letter-spacing: -0.025em;
    }

    #logo,
    #logo > a,
    .brand-name {
        min-width: 0;
    }

    #logo > a {
        max-width: 100%;
        min-height: 2.75rem;
    }

    .user-copy {
        margin: 0 0.65rem 0 0.9rem;
        text-align: right;
    }

    @media (max-width: 640px) {
        .user-copy,
        .optional-nav {
            display: none;
        }

        .brand-name {
            font-size: 0.95rem;
        }

        .brand-mark {
            width: 1.65rem;
            height: 1.65rem;
            margin-right: 0.45rem;
        }

        .brand-logo {
            width: 1.65rem;
            height: 1.65rem;
            margin-right: 0.45rem;
        }
    }

    @media (max-width: 420px) {
        & > div {
            padding-right: 0.75rem;
            padding-left: 0.75rem;
        }

        .brand-name {
            max-width: 6.75rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }
`;

const onTriggerNavButton = () => {
    const sidebar = document.getElementById('sidebar');

    if (sidebar) {
        sidebar.classList.toggle('active-nav');
    }
};

export default () => {
    const name = useStoreState((state: ApplicationStore) => state.settings.data!.name);
    const branding = useStoreState((state: ApplicationStore) => state.settings.data!.branding);
    const username = useStoreState((state: ApplicationStore) => state.user.data!.username);
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const location = useLocation();
    const { clearAndAddHttpError } = useFlash();

    useEffect(() => {
        document.getElementById('sidebar')?.classList.remove('active-nav');
    }, [location.pathname]);

    const onTriggerLogout = () => {
        setIsLoggingOut(true);
        http.post('/auth/logout')
            .then(() => {
                // @ts-expect-error this is valid
                window.location = '/';
            })
            .catch((error) => {
                setIsLoggingOut(false);
                clearAndAddHttpError({ error });
            });
    };

    return (
        <Topbar className={'topbar'}>
            <SpinnerOverlay visible={isLoggingOut} />
            <div className={'w-full flex items-center h-full px-4 sm:px-6'}>
                <button
                    type={'button'}
                    className={'navbar-button'}
                    onClick={onTriggerNavButton}
                    aria-label={'Toggle navigation'}
                    aria-controls={'sidebar'}
                >
                    <FontAwesomeIcon icon={faBars} />
                </button>

                <div id={'logo'} className={'flex-1'}>
                    <Link to={'/'} className={'inline-flex items-center no-underline'}>
                        {branding.logo ? (
                            <img className={'brand-logo'} src={branding.logo} alt={''} aria-hidden={'true'} />
                        ) : (
                            <span className={'brand-mark'}>{branding.mark}</span>
                        )}
                        <span className={'brand-name text-lg font-header font-semibold'}>{name}</span>
                    </Link>
                </div>

                <RightNavigation className={'flex items-center justify-center'}>
                    <SearchContainer />
                    <NotificationCenter />
                    <Tooltip placement={'bottom'} content={'Dashboard'}>
                        <NavLink to={'/'} exact className={'optional-nav'} aria-label={'Dashboard'}>
                            <FontAwesomeIcon icon={faLayerGroup} aria-hidden={'true'} />
                        </NavLink>
                    </Tooltip>
                    {rootAdmin && (
                        <Tooltip placement={'bottom'} content={'Admin'}>
                            <a href={'/admin'} rel={'noreferrer'} className={'optional-nav'} aria-label={'Admin'}>
                                <FontAwesomeIcon icon={faCogs} aria-hidden={'true'} />
                            </a>
                        </Tooltip>
                    )}
                    <div className={'user-copy'}>
                        <p className={'text-xs font-semibold text-neutral-100 leading-tight'}>{username}</p>
                        <p className={'text-2xs text-neutral-500 leading-tight'}>Control panel</p>
                    </div>
                    <Tooltip placement={'bottom'} content={'Account Settings'}>
                        <NavLink to={'/account'} aria-label={'Account settings'}>
                            <span className={'flex items-center w-5 h-5'}>
                                <Avatar.User />
                            </span>
                        </NavLink>
                    </Tooltip>
                    <Tooltip placement={'bottom'} content={'Sign Out'}>
                        <button type={'button'} onClick={onTriggerLogout} aria-label={'Sign out'}>
                            <FontAwesomeIcon icon={faSignOutAlt} aria-hidden={'true'} />
                        </button>
                    </Tooltip>
                </RightNavigation>
            </div>
        </Topbar>
    );
};
