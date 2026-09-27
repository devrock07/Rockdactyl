import TransferListener from '@/components/server/TransferListener';
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Switch, useRouteMatch } from 'react-router-dom';
import NavigationBar from '@/components/NavigationBar';
import TransitionRouter from '@/TransitionRouter';
import WebsocketHandler from '@/components/server/WebsocketHandler';
import { ServerContext } from '@/state/server';
import { CSSTransition } from 'react-transition-group';
import Can from '@/components/elements/Can';
import Spinner from '@/components/elements/Spinner';
import { NotFound, ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import { useStoreState } from 'easy-peasy';
import InstallListener from '@/components/server/InstallListener';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router';
import ConflictStateRenderer from '@/components/server/ConflictStateRenderer';
import PermissionRoute from '@/components/elements/PermissionRoute';
import routes from '@/routers/routes';
import Sidebar from '@/components/Sidebar';
import NavigationIcon from '@/components/elements/NavigationIcon';
import MobileBottomNav from '@/components/MobileBottomNav';
import AnnouncementBanner from '@/components/elements/AnnouncementBanner';

export default () => {
    const match = useRouteMatch<{ id: string }>();
    const location = useLocation();

    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [error, setError] = useState('');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const loadGeneration = useRef(0);

    const id = ServerContext.useStoreState((state) => state.server.data?.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const identifier = ServerContext.useStoreState((state) => state.server.data?.identifier);
    const deprecatedUuidShort = ServerContext.useStoreState((state) => state.server.data?.__deprecatedUuidShort);
    const serverName = ServerContext.useStoreState((state) => state.server.data?.name);
    const allocation = ServerContext.useStoreState((state) =>
        state.server.data?.allocations.find((candidate) => candidate.isDefault)
    );
    const powerState = ServerContext.useStoreState((state) => state.status.value);
    const inConflictState = ServerContext.useStoreState((state) => state.server.inConflictState);
    const serverId = ServerContext.useStoreState((state) => state.server.data?.internalId);
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);
    const clearServerState = ServerContext.useStoreActions((actions) => actions.clearServerState);
    const routeResetKey = `${match.params.id}:${location.pathname}:${location.search}:${location.hash}`;
    const isCurrentServer = [id, uuid, identifier, deprecatedUuidShort].some((value) => value === match.params.id);

    const to = (value: string, url = false) => {
        if (value === '/') {
            return url ? match.url : match.path;
        }
        return `${(url ? match.url : match.path).replace(/\/*$/, '')}/${value.replace(/^\/+/, '')}`;
    };

    useEffect(() => {
        const generation = ++loadGeneration.current;

        setError('');

        getServer(match.params.id).catch((error) => {
            if (loadGeneration.current !== generation) return;

            console.error(error);
            setError(httpErrorToHuman(error));
        });

        return () => {
            if (loadGeneration.current === generation) loadGeneration.current += 1;
            clearServerState();
        };
    }, [match.params.id, loadAttempt]);

    return (
        <React.Fragment key={'server-router'}>
            <NavigationBar />
            <div className={'content-container'}>
                <AnnouncementBanner />
            </div>
            {!uuid || !id || !isCurrentServer ? (
                error ? (
                    <ServerError message={error} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />
                ) : (
                    <Spinner size={'large'} centered />
                )
            ) : (
                <>
                    <CSSTransition timeout={150} classNames={'fade'} appear in>
                        <Sidebar>
                            <div className={'server-sidebar-card'}>
                                <div className={'server-sidebar-topline'}>
                                    <span className={`server-state-dot state-${powerState || 'offline'}`} />
                                    <span>{powerState || 'offline'}</span>
                                </div>
                                <p className={'server-sidebar-name'}>{serverName}</p>
                                {allocation && (
                                    <p className={'server-sidebar-address'}>
                                        {allocation.alias || allocation.ip}:{allocation.port}
                                    </p>
                                )}
                            </div>
                            <div className={'sidebar-section'}>Server management</div>
                            {routes.server
                                .filter((route) => !!route.name)
                                .map((route) =>
                                    route.permission ? (
                                        <Can key={route.path} action={route.permission} matchAny>
                                            <NavLink to={to(route.path, true)} exact={route.exact}>
                                                <div className='icon'>
                                                    <NavigationIcon name={route.name} />
                                                </div>
                                                {route.name}
                                            </NavLink>
                                        </Can>
                                    ) : (
                                        <NavLink key={route.path} to={to(route.path, true)} exact={route.exact}>
                                            <div className='icon'>
                                                <NavigationIcon name={route.name} />
                                            </div>
                                            {route.name}{' '}
                                        </NavLink>
                                    )
                                )}
                            {rootAdmin && (
                                // eslint-disable-next-line react/jsx-no-target-blank
                                <a href={`/admin/servers/view/${serverId}`} target={'_blank'}>
                                    <div className='icon'>
                                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                                    </div>
                                    Admin
                                </a>
                            )}
                        </Sidebar>
                    </CSSTransition>
                    <MobileBottomNav serverId={id} />
                    <InstallListener />
                    <TransferListener />
                    <WebsocketHandler />
                    {inConflictState && (!rootAdmin || (rootAdmin && !location.pathname.endsWith(`/server/${id}`))) ? (
                        <ConflictStateRenderer />
                    ) : (
                        <ErrorBoundary resetKey={routeResetKey}>
                            <TransitionRouter>
                                <Switch location={location}>
                                    {routes.server.map(({ path, permission, component: Component }) => (
                                        <PermissionRoute key={path} permission={permission} path={to(path)} exact>
                                            <Spinner.Suspense resetKey={routeResetKey}>
                                                <Component />
                                            </Spinner.Suspense>
                                        </PermissionRoute>
                                    ))}
                                    <Route path={'*'} component={NotFound} />
                                </Switch>
                            </TransitionRouter>
                        </ErrorBoundary>
                    )}
                </>
            )}
        </React.Fragment>
    );
};
