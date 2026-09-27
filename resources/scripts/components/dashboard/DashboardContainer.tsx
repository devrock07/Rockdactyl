import React, { useEffect, useRef, useState } from 'react';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import ServerRow from '@/components/dashboard/ServerRow';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faShieldAlt } from '@fortawesome/free-solid-svg-icons';
import { ShinyText, SplitText } from '@/components/elements/ReactBitsEffects';
import { MagicBentoGrid } from '@/components/elements/reactbits/MagicBento';
import QuickServerDrawer from '@/components/dashboard/QuickServerDrawer';
import { ServerStats } from '@/api/server/getServerResourceUsage';
import { getRockAccountData, RockAccountData, saveServerPreferences, ServerPreference } from '@/api/account/rockData';
import {
    allPreferenceFieldsDirty,
    DirtyPreferenceFields,
    hasDirtyPreferenceFields,
    mergeHydratedServerPreferences,
    PreferenceSyncStatus,
    ServerPreferenceSaveQueue,
    ServerPreferences,
} from '@/components/dashboard/serverPreferencesSync';

const DashboardHero = styled.section.attrs({ className: 'rock-dashboard-heading' as string })`
    position: relative;
    margin-right: -2rem;
    margin-bottom: 2.5rem;
    margin-left: -2rem;
    padding: 3.5rem 2rem 2.35rem;
    overflow: hidden;
    border-bottom: 1px solid var(--shell-border);
    background: linear-gradient(105deg, var(--shell-bg), rgba(var(--shell-accent-rgb), 0.14), var(--shell-panel));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035), inset 0 -30px 90px rgba(0, 0, 0, 0.12);

    .hero-art {
        position: absolute;
        inset: 0 0 0 42%;
        z-index: 1;
        pointer-events: none;
        background-repeat: no-repeat;
        background-position: center 42%;
        background-size: cover;
        opacity: 0.58;
        filter: saturate(0.86) contrast(1.03);
        -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.35) 18%, black 42%, black 100%);
        mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.35) 18%, black 42%, black 100%);
    }

    .hero-content {
        position: relative;
        z-index: 2;
        max-width: 48rem;
    }

    .hero-content::before {
        position: absolute;
        top: -0.4rem;
        bottom: -0.4rem;
        left: -1.15rem;
        width: 1px;
        content: '';
        background: linear-gradient(180deg, transparent, rgba(var(--shell-accent-rgb), 0.48), transparent);
    }

    &::before {
        position: absolute;
        top: -13rem;
        left: 52%;
        width: 34rem;
        height: 25rem;
        content: '';
        pointer-events: none;
        border-radius: 50%;
        background: rgba(var(--shell-accent-rgb), 0.2);
        filter: blur(100px);
    }

    .eyebrow,
    .hero-stat {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        text-transform: uppercase;
    }

    .eyebrow {
        margin-bottom: 1.1rem;
        color: #77737f;
        font-size: 0.64rem;
        font-weight: 600;
        letter-spacing: 0.16em;
    }

    .hero-copy {
        position: relative;
        z-index: 1;
        max-width: 36rem;
        margin-top: 1rem;
        color: var(--shell-muted);
        font-size: 0.88rem;
        line-height: 1.7;
    }

    .hero-stats {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 1.35rem;
        margin-top: 2.2rem;
    }

    .hero-stat {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: #9c99a3;
        font-size: 0.64rem;
        letter-spacing: 0.05em;
        padding: 0.38rem 0.58rem;
        border: 1px solid rgba(255, 255, 255, 0.065);
        border-radius: 999px;
        background: rgba(8, 8, 9, 0.34);
        backdrop-filter: blur(12px);
    }

    .hero-dot {
        width: 0.38rem;
        height: 0.38rem;
        flex: none;
        aspect-ratio: 1 / 1;
        color: var(--shell-success);
    }

    @media (max-width: 1150px) {
        margin-right: -1.25rem;
        margin-left: -1.25rem;
        padding-right: 1.25rem;
        padding-left: 1.25rem;
    }

    @media (max-width: 640px) {
        margin-right: -1rem;
        margin-left: -1rem;
        margin-bottom: 1.6rem;
        padding: 2.7rem 1rem 1.8rem;
        .hero-art {
            left: 18%;
            opacity: 0.24;
        }
        .hero-content::before {
            display: none;
        }
        .hero-stats {
            flex-wrap: wrap;
            gap: 0.65rem 1rem;
            margin-top: 1.55rem;
        }
        .hero-copy {
            max-width: 18rem;
            margin-top: 0.8rem;
            font-size: 0.82rem;
        }
    }
`;

const DashboardToolbar = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    margin-bottom: 0.85rem;

    @media (max-width: 640px) {
        align-items: flex-start;
        flex-direction: column;
    }
`;

const PreferenceSyncIndicator = styled.div`
    display: inline-flex;
    min-height: 2rem;
    align-items: center;
    gap: 0.45rem;
    color: var(--shell-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;

    &::before {
        width: 0.38rem;
        height: 0.38rem;
        content: '';
        border-radius: 999px;
        background: var(--shell-warning);
        box-shadow: 0 0 9px color-mix(in srgb, var(--shell-warning) 55%, transparent);
    }

    &[data-state='saving']::before {
        background: var(--shell-accent-bright);
        animation: preference-sync-pulse 1s ease-in-out infinite;
    }

    &[data-state='loading']::before {
        background: var(--shell-muted);
    }

    button {
        padding: 0.28rem 0.52rem;
        color: var(--shell-accent-bright);
        border: 1px solid rgba(var(--shell-accent-rgb), 0.26);
        border-radius: 6px;
        background: rgba(var(--shell-accent-rgb), 0.08);
    }

    button:hover {
        border-color: rgba(var(--shell-accent-rgb), 0.42);
        background: rgba(var(--shell-accent-rgb), 0.14);
    }

    @keyframes preference-sync-pulse {
        50% {
            opacity: 0.4;
        }
    }
`;

const ServerGrid = styled(MagicBentoGrid)`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
    @media (max-width: 900px) {
        grid-template-columns: 1fr;
    }
`;

const SkeletonCard = styled.div`
    min-height: 14rem;
    border: 1px solid var(--shell-border);
    border-radius: var(--shell-radius);
    background: linear-gradient(
        110deg,
        rgba(255, 255, 255, 0.018) 8%,
        rgba(var(--shell-accent-rgb), 0.07) 18%,
        rgba(255, 255, 255, 0.018) 33%
    );
    background-size: 220% 100%;
    animation: skeleton-wave 1.5s linear infinite;
    @keyframes skeleton-wave {
        to {
            background-position-x: -220%;
        }
    }
`;

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');
    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const uuid = useStoreState((state) => state.user.data!.uuid);
    const username = useStoreState((state) => state.user.data!.username);
    const branding = useStoreState((state) => state.settings.data!.branding);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const preferenceStorageKey = `${uuid}:server_preferences`;
    const preferenceUnsyncedKey = `${uuid}:server_preferences_unsynced`;
    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);
    const [preferences, setPreferences] = usePersistedState<Record<string, ServerPreference>>(preferenceStorageKey, {});
    const [activeGroup, setActiveGroup] = useState('All');
    const [quickServer, setQuickServer] = useState<{ server: Server; stats: ServerStats | null } | null>(null);
    const preferencesReady = useRef(false);
    const mounted = useRef(true);
    const preferencesRef = useRef<ServerPreferences>(preferences || {});
    const initiallyUnsynced = useRef(localStorage.getItem(preferenceUnsyncedKey) === '1');
    const dirtyPreferenceFields = useRef<DirtyPreferenceFields>(
        initiallyUnsynced.current ? allPreferenceFieldsDirty(preferencesRef.current) : {}
    );
    const [preferenceSyncStatus, setPreferenceSyncStatus] = useState<PreferenceSyncStatus>(
        initiallyUnsynced.current ? 'unsynced' : 'loading'
    );
    const [accountData, setAccountData] = useState<RockAccountData>();
    const preferenceSaveQueue = useRef<ServerPreferenceSaveQueue>();
    if (!preferenceSaveQueue.current) {
        preferenceSaveQueue.current = new ServerPreferenceSaveQueue(saveServerPreferences, (status) => {
            if (status === 'saved') {
                localStorage.removeItem(preferenceUnsyncedKey);
            } else if (status === 'unsynced') {
                localStorage.setItem(preferenceUnsyncedKey, '1');
            }
            if (mounted.current) setPreferenceSyncStatus(status);
        });
    }
    const {
        data: servers,
        error,
        isValidating,
        mutate,
    } = useSWR<PaginatedResult<Server>>(['/api/client/servers', showOnlyAdmin && rootAdmin, page], () =>
        getServers({ page, type: showOnlyAdmin && rootAdmin ? 'admin' : undefined })
    );

    useEffect(() => {
        let active = true;
        let retryTimer: number | undefined;
        const loadPreferences = () => {
            const retry = () => {
                if (active) retryTimer = window.setTimeout(loadPreferences, 5000);
            };
            getRockAccountData()
                .then((data) => {
                    if (!data.preferencesAvailable) {
                        retry();
                        return;
                    }
                    if (active) setAccountData(data);
                })
                .catch(retry);
        };

        loadPreferences();
        return () => {
            active = false;
            window.clearTimeout(retryTimer);
        };
    }, []);

    useEffect(() => setPage(1), [showOnlyAdmin]);
    useEffect(() => {
        if (servers && servers.pagination.currentPage > 1 && !servers.items.length) setPage(1);
    }, [servers?.pagination.currentPage]);
    useEffect(() => {
        window.history.replaceState(null, document.title, `/${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);
    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'dashboard', error });
        if (!error) clearFlashes('dashboard');
    }, [error]);
    useEffect(() => {
        if (!accountData || preferencesReady.current) return;
        const local = preferencesRef.current;
        const merged = mergeHydratedServerPreferences(
            accountData.serverPreferences,
            local,
            dirtyPreferenceFields.current
        );
        preferencesRef.current = merged;
        setPreferences(merged);
        preferencesReady.current = true;
        if (
            hasDirtyPreferenceFields(dirtyPreferenceFields.current) ||
            (Object.keys(local).length > 0 && Object.keys(accountData.serverPreferences).length === 0)
        ) {
            preferenceSaveQueue.current!.enqueue(merged, 0);
        } else {
            preferenceSaveQueue.current!.seed(merged);
        }
    }, [accountData]);
    useEffect(() => {
        mounted.current = true;
        const flushLatest = () => {
            if (preferencesReady.current) void preferenceSaveQueue.current!.flushLatest(preferencesRef.current);
        };
        const flushWhenHidden = () => {
            if (document.visibilityState === 'hidden') flushLatest();
        };

        document.addEventListener('visibilitychange', flushWhenHidden);
        window.addEventListener('pagehide', flushLatest);
        return () => {
            mounted.current = false;
            document.removeEventListener('visibilitychange', flushWhenHidden);
            window.removeEventListener('pagehide', flushLatest);
            if (preferencesReady.current) preferenceSaveQueue.current!.dispose(preferencesRef.current);
        };
    }, []);

    const dashboardSubtitle = branding.dashboardSubtitle.replace(/\{username\}/gi, username);
    const serverPreferences = preferences || {};
    const updatePreference = (serverId: string, next: Partial<ServerPreference>) => {
        const current = preferencesRef.current;
        const currentPreference = current[serverId] || { favorite: false, group: '' };
        const updatedPreference = { ...currentPreference, ...next };
        const dirty = dirtyPreferenceFields.current[serverId] || {};
        let changed = false;

        if (next.favorite !== undefined && next.favorite !== currentPreference.favorite) {
            dirty.favorite = true;
            changed = true;
        }
        if (next.group !== undefined && next.group !== currentPreference.group) {
            dirty.group = true;
            changed = true;
        }
        if (!changed) return;

        dirtyPreferenceFields.current[serverId] = dirty;
        const updated = { ...current, [serverId]: updatedPreference };
        preferencesRef.current = updated;
        localStorage.setItem(preferenceStorageKey, JSON.stringify(updated));
        localStorage.setItem(preferenceUnsyncedKey, '1');
        setPreferences(updated);
        setPreferenceSyncStatus('unsynced');
        if (preferencesReady.current) preferenceSaveQueue.current!.enqueue(updated);
    };
    const groups = Array.from(
        new Set((servers?.items || []).map((server) => serverPreferences[server.id]?.group?.trim()).filter(Boolean))
    ) as string[];

    return (
        <PageContentBlock className='content-dashboard' title={'Dashboard'} showFlashKey={'dashboard'}>
            <DashboardHero>
                {!!branding.dashboardImage && (
                    <div className={'hero-art'} style={{ backgroundImage: `url("${branding.dashboardImage}")` }} />
                )}
                <div className={'hero-content'}>
                    <p className={'eyebrow'}>
                        <ShinyText>{branding.owner} / Control</ShinyText>
                    </p>
                    <SplitText text={branding.dashboardTitle} />
                    {!!dashboardSubtitle && <p className={'hero-copy'}>{dashboardSubtitle}</p>}
                    <div className={'hero-stats'}>
                        <div className={'hero-stat'}>
                            <FontAwesomeIcon icon={faCircle} className={'hero-dot'} />
                            {servers ? servers.pagination.total : '—'} total
                        </div>
                        <div className={'hero-stat'}>{rootAdmin ? 'Administrator' : 'Member'}</div>
                    </div>
                </div>
            </DashboardHero>
            {rootAdmin && (
                <DashboardToolbar>
                    <div css={tw`flex items-center`}>
                        <FontAwesomeIcon icon={faShieldAlt} css={tw`text-neutral-500 mr-2`} />
                        <p css={tw`uppercase text-xs text-neutral-400 mr-2`}>
                            {showOnlyAdmin ? "Showing others' servers" : 'Showing your servers'}
                        </p>
                        <Switch
                            name={'show_all_servers'}
                            defaultChecked={showOnlyAdmin}
                            onChange={() => setShowOnlyAdmin((s) => !s)}
                        />
                    </div>
                </DashboardToolbar>
            )}
            <div
                className={
                    'flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 p-3 rounded-xl border border-white/5 bg-black/20 backdrop-blur-md'
                }
            >
                <div className={'flex flex-wrap items-center gap-2'}>
                    <span className={'text-xs font-semibold uppercase tracking-wider text-neutral-500 mr-1'}>
                        Filters:
                    </span>
                    {['All', 'Favorites', ...groups].map((group) => (
                        <button
                            key={group}
                            onClick={() => setActiveGroup(group)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                activeGroup === group
                                    ? 'border-primary-500/50 text-primary-300 bg-primary-900/40 shadow-sm shadow-primary-900'
                                    : 'border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300 bg-neutral-900/50'
                            }`}
                        >
                            {group === 'All' ? 'All Servers' : group}
                        </button>
                    ))}
                </div>
                {preferenceSyncStatus !== 'saved' && (
                    <PreferenceSyncIndicator data-state={preferenceSyncStatus} role={'status'} aria-live={'polite'}>
                        <span>
                            {preferenceSyncStatus === 'loading'
                                ? 'Loading preferences'
                                : preferenceSyncStatus === 'saving'
                                ? 'Saving preferences'
                                : 'Preferences not synced'}
                        </span>
                        {preferenceSyncStatus === 'unsynced' && preferencesReady.current && (
                            <button type={'button'} onClick={() => preferenceSaveQueue.current!.retry()}>
                                Retry
                            </button>
                        )}
                    </PreferenceSyncIndicator>
                )}
            </div>
            {!servers && error ? (
                <div css={tw`rounded-xl border border-neutral-700 bg-neutral-900/70 px-5 py-10 text-center`}>
                    <p css={tw`text-sm text-neutral-300`}>Could not load your servers.</p>
                    <button
                        type={'button'}
                        disabled={isValidating}
                        css={tw`mt-4 rounded border border-red-500 px-4 py-2 text-sm text-red-200 disabled:opacity-50`}
                        onClick={() => mutate()}
                    >
                        {isValidating ? 'Retrying…' : 'Retry'}
                    </button>
                </div>
            ) : !servers ? (
                <ServerGrid>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <SkeletonCard key={index} />
                    ))}
                </ServerGrid>
            ) : (
                <Pagination data={servers} onPageSelect={setPage}>
                    {({ items }) => {
                        const visibleItems = items
                            .filter(
                                (server) =>
                                    activeGroup === 'All' ||
                                    (activeGroup === 'Favorites'
                                        ? serverPreferences[server.id]?.favorite
                                        : serverPreferences[server.id]?.group === activeGroup)
                            )
                            .sort(
                                (left, right) =>
                                    Number(!!serverPreferences[right.id]?.favorite) -
                                    Number(!!serverPreferences[left.id]?.favorite)
                            );
                        return visibleItems.length ? (
                            <ServerGrid>
                                {visibleItems.map((server) => (
                                    <ServerRow
                                        key={server.uuid}
                                        server={server}
                                        favorite={!!serverPreferences[server.id]?.favorite}
                                        onToggleFavorite={() =>
                                            updatePreference(server.id, {
                                                favorite: !serverPreferences[server.id]?.favorite,
                                            })
                                        }
                                        onOpenQuick={(selected, stats) => setQuickServer({ server: selected, stats })}
                                    />
                                ))}
                            </ServerGrid>
                        ) : (
                            <p css={tw`text-center text-sm text-neutral-400`}>
                                {showOnlyAdmin
                                    ? 'There are no other servers to display.'
                                    : 'There are no servers associated with your account.'}
                            </p>
                        );
                    }}
                </Pagination>
            )}
            {quickServer && (
                <QuickServerDrawer
                    server={quickServer.server}
                    stats={quickServer.stats}
                    group={serverPreferences[quickServer.server.id]?.group || ''}
                    onGroupChange={(group) => updatePreference(quickServer.server.id, { group })}
                    onClose={() => setQuickServer(null)}
                />
            )}
        </PageContentBlock>
    );
};
