import React, { lazy } from 'react';
import { hot } from 'react-hot-loader/root';
import { Route, Router, Switch, useLocation } from 'react-router-dom';
import { StoreProvider } from 'easy-peasy';
import { store } from '@/state';
import { SiteSettings } from '@/state/settings';
import ProgressBar from '@/components/elements/ProgressBar';
import { NotFound } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import GlobalStylesheet from '@/assets/css/GlobalStylesheet';
import { history } from '@/components/history';
import { setupInterceptors } from '@/api/interceptors';
import AuthenticatedRoute from '@/components/elements/AuthenticatedRoute';
import { ServerContext } from '@/state/server';
import '@/assets/tailwind.css';
import Spinner from '@/components/elements/Spinner';

import ThemeRuntime from '@/components/ThemeRuntime';
import PublicStatusPage from '@/components/status/PublicStatusPage';
import { ConfigInterface, SWRConfig } from 'swr';
import { initializeRockNotificationScope } from '@/components/notifications/rockNotifications';

const DashboardRouter = lazy(() => import(/* webpackChunkName: "dashboard" */ '@/routers/DashboardRouter'));
const ServerRouter = lazy(() => import(/* webpackChunkName: "server" */ '@/routers/ServerRouter'));
const AuthenticationRouter = lazy(() => import(/* webpackChunkName: "auth" */ '@/routers/AuthenticationRouter'));

interface ExtendedWindow extends Window {
    SiteConfiguration?: SiteSettings;
    PterodactylUser?: {
        uuid: string;
        username: string;
        email: string;
        /* eslint-disable camelcase */
        root_admin: boolean;
        use_totp: boolean;
        language: string;
        updated_at: string;
        created_at: string;
        /* eslint-enable camelcase */
    };
}

setupInterceptors(history);

const onSWRRetry: NonNullable<ConfigInterface['onErrorRetry']> = (error, _key, _config, revalidate, options) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const retryCount = options.retryCount ?? 0;

    if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return;
    if (retryCount > 3) return;

    window.setTimeout(
        () => revalidate({ ...options, dedupe: true }),
        Math.min(15000, 1000 * 2 ** Math.max(0, retryCount - 1))
    );
};

const ApplicationRoutes = () => {
    const location = useLocation();
    const resetKey = `${location.pathname}:${location.search}:${location.hash}`;

    return (
        <Switch location={location}>
            <Route path={'/status'} exact>
                <PublicStatusPage />
            </Route>
            <Route path={'/auth'}>
                <Spinner.Suspense resetKey={resetKey}>
                    <AuthenticationRouter />
                </Spinner.Suspense>
            </Route>
            <AuthenticatedRoute path={'/server/:id'}>
                <Spinner.Suspense resetKey={resetKey}>
                    <ServerContext.Provider>
                        <ServerRouter />
                    </ServerContext.Provider>
                </Spinner.Suspense>
            </AuthenticatedRoute>
            <AuthenticatedRoute path={'/'}>
                <Spinner.Suspense resetKey={resetKey}>
                    <DashboardRouter />
                </Spinner.Suspense>
            </AuthenticatedRoute>
            <Route path={'*'}>
                <NotFound />
            </Route>
        </Switch>
    );
};

const App = () => {
    const { PterodactylUser, SiteConfiguration } = window as ExtendedWindow;
    initializeRockNotificationScope(PterodactylUser?.uuid);

    if (PterodactylUser && !store.getState().user.data) {
        store.getActions().user.setUserData({
            uuid: PterodactylUser.uuid,
            username: PterodactylUser.username,
            email: PterodactylUser.email,
            language: PterodactylUser.language,
            rootAdmin: PterodactylUser.root_admin,
            useTotp: PterodactylUser.use_totp,
            createdAt: new Date(PterodactylUser.created_at),
            updatedAt: new Date(PterodactylUser.updated_at),
        });
    }

    if (!store.getState().settings.data) {
        store.getActions().settings.setSettings(SiteConfiguration!);
    }

    return (
        <>
            <GlobalStylesheet />
            <StoreProvider store={store}>
                <SWRConfig value={{ onErrorRetry: onSWRRetry, errorRetryCount: 3 }}>
                    <ThemeRuntime />

                    <ProgressBar />
                    <div css={tw`mx-auto w-auto`} className='nook-container'>
                        <Router history={history}>
                            <ApplicationRoutes />
                        </Router>
                    </div>
                </SWRConfig>
            </StoreProvider>
        </>
    );
};

export default process.env.NODE_ENV === 'development' ? hot(App) : App;
